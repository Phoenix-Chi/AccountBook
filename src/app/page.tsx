"use client";
import { useState, useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AccountingState {
  firstRun: boolean;
  // 资金库初始金额
  initialAmount1: number;
  initialAmount2: number;
  // 当前余额
  balance1: number;
  balance2: number;
  // 收支记录
  records: Array<{
    date: string;
    type: 'income' | 'expense';
    amount1: number;
    amount2: number;
    fund1Allocation: number;
    fund2Allocation: number;
    fund1Change: number;
    fund2Change: number;
    fund1Balance: number;
    fund2Balance: number;
    note?: string;
  }>;
  // 设置初始金额
  setInitialAmounts: (amount1: number, amount2: number) => void;
  // 添加收支记录
  addRecord: (amount1: number , amount2: number , fund1Allocation: number , fund2Allocation: number , note: string) => void;
  // 撤销最后一条记录
  undoLastRecord: () => void;
}

const useAccountingStore = create<AccountingState>()(
  persist(
    (set) => ({
      firstRun: true,
      initialAmount1: 0,
      initialAmount2: 0,
      balance1: 0,
      balance2: 0,
      records: [],

      setInitialAmounts: (amount1, amount2) => {
        set((state) => {
          const diff1 = amount1 - state.initialAmount1;
          const diff2 = amount2 - state.initialAmount2;
          return {
            initialAmount1: amount1,
            initialAmount2: amount2,
            balance1: state.balance1 + diff1,
            balance2: state.balance2 + diff2
          };
        });
      },

      addRecord: (amt1, amt2, fund1, fund2, note) => {
        set((state) => {

          let fund1Change = 0;
          let fund2Change = 0;

          // 微信计算
          if (Math.abs(fund1) <= 1) {
            fund1Change = amt1 * fund1;
          } else {
            fund1Change = fund1;
          }

          // 银行卡计算
          if (Math.abs(fund2) <= 1) {
            fund2Change = amt2 * fund2;
          } else {
            fund2Change = fund2;
          }

          // 只有余额变化时才记录
          if (fund1Change !== 0 || fund2Change !== 0) {
            const newFund1Balance = state.balance1 + fund1Change;
            const newFund2Balance = state.balance2 + fund2Change;

            const newRecord = {
              date: new Date().toLocaleString(),
              type: fund1Change + fund2Change >= 0 ? 'income' : 'expense',
              amount1: amt1,
              amount2: amt2,
              fund1Allocation: fund1,
              fund2Allocation: fund2,
              fund1Change,
              fund2Change,
              fund1Balance: newFund1Balance,
              fund2Balance: newFund2Balance,
              note,
              amount: amt1 + amt2
            };

            return {
              balance1: newFund1Balance,
              balance2: newFund2Balance,
              records: [newRecord, ...state.records] // 新记录放在最前面
            };
          }
          return state;
        });
      },

      undoLastRecord: () => {
        set((state) => {
          if (state.records.length === 0) return state;

          const lastRecord = state.records[0];
          return {
            balance1: state.balance1 - lastRecord.fund1Change,
            balance2: state.balance2 - lastRecord.fund2Change,
            records: state.records.slice(1)
          };
        });
      }
    }),
    {
      name: "accounting-storage",
      getStorage: () => ({
        getItem: async (name: string) => {
          const db = await openDB();
          return (await db.get("accounting", name))?.value || null;
        },
        setItem: async (name: string, value: string) => {
          const db = await openDB();
          await db.put("accounting", { name, value });
        },
        removeItem: async (name: string) => {
          const db = await openDB();
          await db.delete("accounting", name);
        },
      }),
    }
  )
);

async function openDB() {
  return new Promise<IDBDatabase>((resolve) => {
    const request = indexedDB.open("AccountingDB", 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("accounting")) {
        db.createObjectStore("accounting", { keyPath: "name" });
      }
    };
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
}

export default function AccountingApp() {
  const {
    initialAmount1,
    initialAmount2,
    balance1,
    balance2,
    records,
    setInitialAmounts,
    addRecord,
    undoLastRecord
  } = useAccountingStore();

  const [setupMode, setSetupMode] = useState(true);
  const [showUndoDialog, setShowUndoDialog] = useState(false);

  useEffect(() => {
    setSetupMode(useAccountingStore.getState().firstRun);
  }, []);
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [fund1Allocation, setFund1Allocation] = useState("");
  const [fund2Allocation, setFund2Allocation] = useState("");
  const [note, setNote] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editAmount1, setEditAmount1] = useState("");
  const [editAmount2, setEditAmount2] = useState("");

  const handleSetup = () => {
    if (!isNaN(initialAmount1) && !isNaN(initialAmount2)) {
      useAccountingStore.setState({ firstRun: false });
      setSetupMode(false);
    }
  };

  const handleRecord = () => {
    const amt1 = isNaN(parseFloat(String(amount1))) ? 0 : parseFloat(String(amount1));
    const amt2 = isNaN(parseFloat(String(amount2))) ? 0 : parseFloat(String(amount2));
    const fund1 = isNaN(parseFloat(String(fund1Allocation))) ? 0 : parseFloat(String(fund1Allocation));
    const fund2 = isNaN(parseFloat(String(fund2Allocation))) ? 0 : parseFloat(String(fund2Allocation));
    if (fund1 > 1 || fund2 > 1 ||  (fund1 <=1 && amt1 !== 0) || (fund2 <=1 && amt2 !== 0)) {
      addRecord(amt1, amt2, fund1, fund2, note);
      setAmount1("");
      setAmount2("");
      // setFund1Allocation("");
      // setFund2Allocation("");
      setNote("");
    }
  };

  const handleUndoConfirm = () => {
    undoLastRecord();
    setShowUndoDialog(false);
  };

  useEffect(() => {
    if (showEditDialog) {
      setEditAmount1(initialAmount1.toString());
      setEditAmount2(initialAmount2.toString());
    }
  }, [showEditDialog, initialAmount1, initialAmount2]);

  const handleEditSubmit = () => {
    const num1 = parseFloat(editAmount1);
    const num2 = parseFloat(editAmount2);
    if (!isNaN(num1) && !isNaN(num2)) {
      setInitialAmounts(num1, num2);
      setShowEditDialog(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-8">记账</h1>

      {setupMode ? (
        <div className="w-full max-w-md space-y-4">
          <div className="space-y-2">
            <label className="block">微信初始金额</label>
            <input
              type="number"
              value={initialAmount1}
              onChange={(e) => {
                setInitialAmounts(parseFloat(e.target.value) || 0, initialAmount2);
              }}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="space-y-2">
            <label className="block">银行卡初始金额</label>
            <input
              type="number"
              value={initialAmount2}
              onChange={(e) => {
                setInitialAmounts(initialAmount1, parseFloat(e.target.value) || 0);
              }}
              className="w-full p-2 border rounded"
            />
          </div>
          <button
            onClick={handleSetup}
            className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            设置初始金额
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => setShowEditDialog(true)}
              className="bg-blue-500 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded"
            >
              修改起始余额
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">微信</h3>
              <p className="text-2xl">¥{balance1.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">银行卡</h3>
              <p className="text-2xl">¥{balance2.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* 微信输入框组 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block">微信预分配金额</label>
                <input
                  type="number"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="输入正负金额"
                />
              </div>

              <div className="space-y-2">
                <label className="block">微信分配比例/金额</label>
                <input
                  type="number"
                  value={fund1Allocation}
                  onChange={(e) => setFund1Allocation(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="输入比例(0-1)或固定金额"
                />
              </div>
            </div>

            {/* 银行卡输入框组 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block">银行卡预分配金额</label>
                <input
                  type="number"
                  value={amount2}
                  onChange={(e) => setAmount2(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="输入正负金额"
                />
              </div>

              <div className="space-y-2">
                <label className="block">银行卡分配比例/金额</label>
                <input
                  type="number"
                  value={fund2Allocation}
                  onChange={(e) => setFund2Allocation(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="输入比例(0-1)或固定金额"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block">备注</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="输入备注信息"
              />
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setShowUndoDialog(true)}
                className="flex-1 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                disabled={records.length === 0}
              >
                撤销
              </button>
              <button
                onClick={handleRecord}
                className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                记账
              </button>
            </div>
          </div>

          <dialog 
            open={showEditDialog} 
            onClose={() => setShowEditDialog(false)}
            className="fixed sm:top-1/2 sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:-translate-y-1/2 
           bottom-0 left-0 right-0 sm:bottom-auto sm:rounded-lg rounded-t-lg p-6 shadow-lg bg-white max-w-md sm:mx-0 mx-auto"
          >
            <div className="space-y-4">
              <h3 className="text-lg font-bold">修改起始余额</h3>
              <div className="space-y-2">
                <label className="block">微信起始金额</label>
                <input
                  type="number"
                  value={editAmount1}
                  onChange={(e) => setEditAmount1(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="space-y-2">
                <label className="block">银行卡起始金额</label>
                <input
                  type="number"
                  value={editAmount2}
                  onChange={(e) => setEditAmount2(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button 
                  onClick={() => setShowEditDialog(false)}
                  className="px-4 py-2 border rounded"
                >
                  取消
                </button>
                <button 
                  onClick={handleEditSubmit}
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  确定
                </button>
              </div>
            </div>
          </dialog>

          <dialog 
            open={showUndoDialog} 
            onClose={() => setShowUndoDialog(false)}
            className="fixed sm:top-1/2 sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:-translate-y-1/2 
           bottom-0 left-0 right-0 sm:bottom-auto sm:rounded-lg rounded-t-lg p-6 shadow-lg bg-white max-w-md sm:mx-0 mx-auto"
          >
            <div className="space-y-4">
              <h3 className="text-lg font-bold">确认撤销</h3>
              <p>确定要撤销最后一条记录吗？此操作无法恢复。</p>
              <div className="flex justify-end space-x-2">
                <button 
                  onClick={() => setShowUndoDialog(false)}
                  className="px-4 py-2 border rounded"
                >
                  取消
                </button>
                <button 
                  onClick={handleUndoConfirm}
                  className="px-4 py-2 bg-red-500 text-white rounded"
                >
                  确定
                </button>
              </div>
            </div>
          </dialog>

          <div className="mt-8">
            <h3 className="font-semibold mb-2">记账记录</h3>
            <div className="space-y-2">
              {records.length === 0 ? (
                <p className="text-gray-500">暂无记录</p>
              ) : (
                records.map((record, index) => (
                  <div key={index} className="p-3 border rounded">
                    <div className="font-medium mb-2">{record.date}</div>

                    {record.fund1Change !== 0 && (
                      <div className="mb-2">
                        <div className="text-sm">微信:</div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>预分配: {record.amount1.toFixed(2)}</div>
                          <div>分配: {record.fund1Allocation}</div>
                          <div className={`font-semibold ${record.fund1Change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            实际: {record.fund1Change >= 0 ? '+' : ''}{record.fund1Change.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}

                    {record.fund2Change !== 0 && (
                      <div className="mb-2">
                        <div className="text-sm">银行卡:</div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>预分配: {record.amount2.toFixed(2)}</div>
                          <div>分配: {record.fund2Allocation}</div>
                          <div className={`font-semibold ${record.fund2Change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            实际: {record.fund2Change >= 0 ? '+' : ''}{record.fund2Change.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}

                    {record.note && (
                      <div className="text-sm text-gray-600">备注: {record.note}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

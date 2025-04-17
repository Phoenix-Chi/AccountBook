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

            const newRecord: AccountingState['records'][0] = {
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
              note
            };

            return {
              balance1: newFund1Balance,
              balance2: newFund2Balance,
              records: [newRecord, ...state.records]
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
      partialize: (state) => ({
        firstRun: state.firstRun,
        initialAmount1: state.initialAmount1,
        initialAmount2: state.initialAmount2,
        balance1: state.balance1,
        balance2: state.balance2,
        records: state.records,
      }),
      storage: {
        getItem: (name) => {
          const fallbackToLocalStorage = () => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            try {
              return JSON.parse(str);
            } catch {
              return str;
            }
          };

          if (!window.indexedDB) {
            return Promise.resolve(fallbackToLocalStorage());
          }

          return new Promise((resolve) => {
            const request = indexedDB.open("AccountingDB", 1);
            
            request.onerror = () => {
              resolve(fallbackToLocalStorage());
            };

            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction("accounting", "readonly");
              const store = transaction.objectStore("accounting");
              const getRequest = store.get(name);

              getRequest.onerror = () => {
                resolve(fallbackToLocalStorage());
              };

              getRequest.onsuccess = () => {
                if (!getRequest.result) {
                  resolve(fallbackToLocalStorage());
                  return;
                }
                resolve(getRequest.result.value);
              };
            };

            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains("accounting")) {
                db.createObjectStore("accounting", { keyPath: "name" });
              }
            };
          });
        },

        setItem: (name, value) => {
          const fallbackToLocalStorage = () => {
            try {
              localStorage.setItem(name, JSON.stringify(value));
            } catch (e) {
              console.error('Error saving to localStorage:', e);
            }
          };

          if (!window.indexedDB) {
            fallbackToLocalStorage();
            return;
          }

          return new Promise<void>((resolve) => {
            const request = indexedDB.open("AccountingDB", 1);
            
            request.onerror = () => {
              fallbackToLocalStorage();
              resolve();
            };

            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction("accounting", "readwrite");
              const store = transaction.objectStore("accounting");
              const putRequest = store.put({ name, value });

              putRequest.onerror = () => {
                fallbackToLocalStorage();
                resolve();
              };

              putRequest.onsuccess = () => {
                resolve();
              };
            };

            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains("accounting")) {
                db.createObjectStore("accounting", { keyPath: "name" });
              }
            };
          });
        },

        removeItem: (name) => {
          localStorage.removeItem(name);

          if (!window.indexedDB) {
            return Promise.resolve();
          }

          return new Promise<void>((resolve) => {
            const request = indexedDB.open("AccountingDB", 1);
            
            request.onerror = () => {
              resolve();
            };

            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction("accounting", "readwrite");
              const store = transaction.objectStore("accounting");
              const deleteRequest = store.delete(name);

              deleteRequest.onerror = () => {
                resolve();
              };

              deleteRequest.onsuccess = () => {
                resolve();
              };
            };
          });
        }
      }
    }
  )
);

export default function AccountingApp() {
  const {
    firstRun,
    initialAmount1,
    initialAmount2,
    balance1,
    balance2,
    records,
    setInitialAmounts,
    addRecord,
    undoLastRecord
  } = useAccountingStore();

  const [setupMode, setSetupMode] = useState(firstRun);

  useEffect(() => {
    setSetupMode(firstRun);
  }, [firstRun]);

  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [fund1Allocation, setFund1Allocation] = useState("");
  const [fund2Allocation, setFund2Allocation] = useState("");
  const [note, setNote] = useState("");
  const [showUndoDialog, setShowUndoDialog] = useState(false);

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
    if (Math.abs(fund1) > 1 || Math.abs(fund2) > 1 ||  (Math.abs(fund1) <=1 && amt1 !== 0) || (Math.abs(fund2) <=1 && amt2 !== 0)) {
      addRecord(amt1, amt2, fund1, fund2, note);
      setAmount1("");
      setAmount2("");
      setNote("");
    }
  };

  const handleUndoConfirm = () => {
    undoLastRecord();
    setShowUndoDialog(false);
  };

  const handleExportRecords = () => {
    if (records.length === 0) return;

    const currentDate = new Date();
    const fileName = `记账记录_${currentDate.getFullYear()}${(currentDate.getMonth() + 1).toString().padStart(2, '0')}${currentDate.getDate().toString().padStart(2, '0')}_${currentDate.getHours().toString().padStart(2, '0')}${currentDate.getMinutes().toString().padStart(2, '0')}${currentDate.getSeconds().toString().padStart(2, '0')}.txt`;
    
    let content = '记账记录导出\n\n';
    content += `当前储备金信息：\n`;
    content += `微信储备金余额：¥${balance1.toFixed(2)}\n`;
    content += `银行卡储备金余额：¥${balance2.toFixed(2)}\n\n`;
    content += `交易记录：\n\n`;
    
    records.forEach((record) => {
      content += `[${record.date}]\n`;
      if (record.fund1Change !== 0) {
        content += `微信:\n`;
        content += `  预分配: ${record.amount1.toFixed(2)}\n`;
        content += `  分配: ${record.fund1Allocation}\n`;
        content += `  实际: ${record.fund1Change >= 0 ? '+' : ''}${record.fund1Change.toFixed(2)}\n`;
      }
      if (record.fund2Change !== 0) {
        content += `银行卡:\n`;
        content += `  预分配: ${record.amount2.toFixed(2)}\n`;
        content += `  分配: ${record.fund2Allocation}\n`;
        content += `  实际: ${record.fund2Change >= 0 ? '+' : ''}${record.fund2Change.toFixed(2)}\n`;
      }
      if (record.note) {
        content += `备注: ${record.note}\n`;
      }
      content += `\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-md flex justify-between items-center mb-6">
        {!setupMode && (
          <button
            type="button"
            onClick={() => {
              useAccountingStore.setState({ firstRun: true });
              setSetupMode(true);
            }}
            style={{ backgroundColor: 'white' ,border: 'none'}}
            className="py-[2px] px-[6px] font-semibold text-[18px] rounded-md hover:bg-blue-600 transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
          🏰
          </button>
        )}
        <h1 className="text-3xl font-bold">记账</h1>
        {!setupMode && <div style={{ width: '33px' }}></div>} {/* 空div用于平衡布局 */}
      </div>
{/* 这里是设置初始金额的部分 */}
      {/* 如果是第一次运行，显示设置初始金额的输入框 */}
      {/* 否则显示余额和记账记录 */}
      {setupMode ? (
        <div className="w-full max-w-md space-y-4">
          <div className="space-y-2">
            <label htmlFor="initialWechat" className="block">微信初始储备金额💰</label>
            <input
              id="initialWechat"
              type="number"
              value={initialAmount1}
              onChange={(e) => {
                setInitialAmounts(parseFloat(e.target.value) || 0, initialAmount2);
              }}
              className="w-full mr-[7px] p-[4px] border rounded"
              placeholder="输入微信初始金额"
              aria-label="微信初始金额输入框"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="initialBank" className="block">银行卡初始储备金额💰</label>
            <input
              id="initialBank"
              type="number"
              value={initialAmount2}
              onChange={(e) => {
                setInitialAmounts(initialAmount1, parseFloat(e.target.value) || 0);
              }}
              className="w-full mr-[7px] p-[4px] border rounded"
              placeholder="输入银行卡初始金额"
              aria-label="银行卡初始金额输入框"
            />
          </div >

          <div className="flex justify-center pt-[18px]">
          <button
            type="button"
            onClick={handleSetup}
            style={{ backgroundColor: 'rgba(177, 235, 43, 0.9)' }}
            className="w-60  py-[6px] px-[60px] font-semibold rounded-md hover:bg-blue-600 transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-[15px]"
          >
            好
          </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">微信储备金💰</h3>
              <p className="text-2xl">¥{balance1.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">银行卡储备金💰</h3>
              <p className="text-2xl">¥{balance2.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="wechatAmount" className="block">微信总变更金额🪙</label>
                <input
                  id="wechatAmount"
                  type="number"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  className="w-full p-[4px] mr-[6px] border rounded"
                  placeholder="输入正负金额"
                  aria-label="微信预分配金额"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="wechatAllocation" className="block">微信储备金分配🖊️</label>
                <input
                  id="wechatAllocation"
                  type="number"
                  value={fund1Allocation}
                  onChange={(e) => setFund1Allocation(e.target.value)}
                  className="w-full p-[4px] mr-[6px] border rounded"
                  placeholder="输入比例(0-1)或固定金额"
                  aria-label="微信分配比例或金额"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="bankAmount" className="block">银行卡总变更金额🪙</label>
                <input
                  id="bankAmount"
                  type="number"
                  value={amount2}
                  onChange={(e) => setAmount2(e.target.value)}
                  className="w-full p-[4px] mr-[6px] border rounded"
                  placeholder="输入正负金额"
                  aria-label="银行卡预分配金额"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="bankAllocation" className="block">银行卡储备金分配🖊️</label>
                <input
                  id="bankAllocation"
                  type="number"
                  value={fund2Allocation}
                  onChange={(e) => setFund2Allocation(e.target.value)}
                  className="w-full p-[4px] mr-[6px] border rounded"
                  placeholder="输入比例(0-1)或固定金额"
                  aria-label="银行卡分配比例或金额"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="noteInput" className="block">备注📃</label>
              <input
                id="noteInput"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-[4px] border rounded"
                placeholder="添加备注信息"
                aria-label="备注信息"
              />
            </div>

            <div className="w-full flex justify-center space-x-6 mt-[9px]">
              <button
                type="button"
                onClick={() => setShowUndoDialog(true)}
                style={{ backgroundColor: 'rgba(204, 205, 194, 0.9)' }}
                className="w-44 py-[5px] px-[33px] font-semibold rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                disabled={records.length === 0}
              >
                撤销
              </button>
              <button
                type="button"
                onClick={handleRecord}
                style={{ backgroundColor: 'rgba(177, 235, 43, 0.9)' }} //cursor: 'pointer'//鼠标悬停时显示手型
                className="w-44 py-[5px] px-[33px] font-semibold rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 text-lg"
              >
                记账
              </button>
            </div>
          </div>

          <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 ${showUndoDialog ? 'block' : 'hidden'}`}>
            <div 
              className="fixed left-1/2 top-[46%] -translate-x-1/2 w-[96%] max-w-[380px]
              rounded-lg shadow-lg p-6 mx-auto z-50 border-2"
              style={{ backgroundColor: 'rgba(20, 225, 233, 0.92)' ,border: '2px solid rgba(40, 62, 169, 0.92)' }}
            >
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">确认撤销</h3>
                <p className="text-xl">确定要撤销最新一条记录吗？此操作无法恢复。</p>
                <div className="flex justify-end space-x-4">
                  <button 
                    type="button"
                    onClick={() => setShowUndoDialog(false)}
                    className="px-[8px] py-[5px] text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50 text-2xl"
                  >
                    取消
                  </button>
                  <button 
                    type="button"
                    onClick={handleUndoConfirm}
                    className="px-[8px] py-[5px] font-semibold rounded-md hover:bg-red-600 transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 text-2xl"
                  >
                    确定
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">记账记录</h3>
              <button
                type="button"
                onClick={handleExportRecords}
                className="py-[1px] px-[6px] text-sm font-semibold rounded-md hover:bg-green-600 transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
              >
                导出
              </button>
            </div>
            <div className="space-y-2">
              {records.length === 0 ? (
                <p className="text-gray-500">暂无记录</p>
              ) : (
                records.map((record, index) => (
                  <div key={index} className="p-3 border rounded w-full">
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

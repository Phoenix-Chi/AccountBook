"use client";
import { useState, useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AccountingState {
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
    amount: number;
    fund1Change: number;
    fund2Change: number;
    fund1Balance: number;
    fund2Balance: number;
  }>;
  // 设置初始金额
  setInitialAmounts: (amount1: number, amount2: number) => void;
  // 添加收支记录
  addRecord: (type: 'income' | 'expense', amount1: number, amount2: number, note: string) => void;
  // 撤销最后一条记录
  undoLastRecord: () => void;
}

const useAccountingStore = create<AccountingState>()(
  persist(
    (set) => ({
      initialAmount1: 0,
      initialAmount2: 0,
      balance1: 0,
      balance2: 0,
      records: [],
      
      setInitialAmounts: (amount1, amount2) => {
        set({
          initialAmount1: amount1,
          initialAmount2: amount2,
          balance1: amount1,
          balance2: amount2
        });
      },
      
  addRecord: (amount1, amount2, fund1Allocation, fund2Allocation, note) => {
        set((state) => {
          const isIncome1 = parseFloat(amount1) >= 0;
          const isIncome2 = parseFloat(amount2) >= 0;
          
          let fund1Change = 0;
          let fund2Change = 0;
          
          // 资金库1计算
          if (isIncome1) {
            if (parseFloat(fund1Allocation) <= 1) {
              fund1Change = parseFloat(amount1) * parseFloat(fund1Allocation);
            } else {
              fund1Change = parseFloat(fund1Allocation);
            }
          } else {
            fund1Change = -Math.abs(parseFloat(fund1Allocation));
          }
          
          // 资金库2计算
          if (isIncome2) {
            if (parseFloat(fund2Allocation) <= 1) {
              fund2Change = parseFloat(amount2) * parseFloat(fund2Allocation);
            } else {
              fund2Change = parseFloat(fund2Allocation);
            }
          } else {
            fund2Change = -Math.abs(parseFloat(fund2Allocation));
          }
          
          const newFund1Balance = state.balance1 + fund1Change;
          const newFund2Balance = state.balance2 + fund2Change;
          
          const newRecord = {
            date: new Date().toLocaleString(),
            type: isIncome1 && isIncome2 ? 'income' : 'expense',
            amount1: parseFloat(amount1),
            amount2: parseFloat(amount2),
            fund1Change,
            fund2Change,
            fund1Balance: newFund1Balance,
            fund2Balance: newFund2Balance,
            note
          };
          
          return {
            balance1: newFund1Balance,
            balance2: newFund2Balance,
            records: [...state.records, newRecord]
          };
        });
      },
      
      undoLastRecord: () => {
        set((state) => {
          if (state.records.length === 0) return state;
          
          const lastRecord = state.records[state.records.length - 1];
          return {
            balance1: state.balance1 - lastRecord.fund1Change,
            balance2: state.balance2 - lastRecord.fund2Change,
            records: state.records.slice(0, -1)
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
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [fund1Allocation, setFund1Allocation] = useState("");
  const [fund2Allocation, setFund2Allocation] = useState("");
  const [note, setNote] = useState("");


  const handleSetup = () => {
    const num1 = parseFloat(amount1);
    const num2 = parseFloat(amount2);
    if (!isNaN(num1) && !isNaN(num2)) {
      setInitialAmounts(num1, num2);
      setSetupMode(false);
    }
  };

  const handleRecord = () => {
    const amt1 = parseFloat(amount1);
    const amt2 = parseFloat(amount2);
    const fund1 = parseFloat(fund1Allocation);
    const fund2 = parseFloat(fund2Allocation);
    
    if (!isNaN(amt1) && !isNaN(amt2) && !isNaN(fund1) && !isNaN(fund2)) {
      addRecord(amt1, amt2, fund1, fund2, note);
      setAmount1("");
      setAmount2("");
      setFund1Allocation("");
      setFund2Allocation("");
      setNote("");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-8">记账应用</h1>
      
      {setupMode ? (
        <div className="w-full max-w-md space-y-4">
          <div className="space-y-2">
            <label className="block">资金库1初始金额</label>
            <input
              type="number"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="space-y-2">
            <label className="block">资金库2初始金额</label>
            <input
              type="number"
              value={amount2}
              onChange={(e) => setAmount2(e.target.value)}
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
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">资金库1</h3>
              <p className="text-2xl">¥{balance1.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-gray-100 rounded">
              <h3 className="font-semibold">资金库2</h3>
              <p className="text-2xl">¥{balance2.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block">资金库1金额（正数为收入，负数为支出）</label>
              <input
                type="number"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="输入正负金额"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block">资金库2金额（正数为收入，负数为支出）</label>
              <input
                type="number"
                value={amount2}
                onChange={(e) => setAmount2(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="输入正负金额"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block">资金库1分配比例/金额</label>
              <input
                type="number"
                value={fund1Allocation}
                onChange={(e) => setFund1Allocation(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="输入比例(0-1)或固定金额"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block">资金库2分配比例/金额</label>
              <input
                type="number"
                value={fund2Allocation}
                onChange={(e) => setFund2Allocation(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="输入比例(0-1)或固定金额"
              />
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
                onClick={handleRecord}
                className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!amount1 || !amount2}
              >
                记账
              </button>
              <button
                onClick={undoLastRecord}
                className="flex-1 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                disabled={records.length === 0}
              >
                撤销
              </button>
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="font-semibold mb-2">记账记录</h3>
            <div className="space-y-2">
              {records.length === 0 ? (
                <p className="text-gray-500">暂无记录</p>
              ) : (
                records.map((record, index) => (
                  <div key={index} className="p-3 border rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{record.date}</div>
                        <div className="text-sm text-gray-600">{record.note || '无备注'}</div>
                      </div>
                      <div className="text-right">
                    <div className={`font-semibold ${record.amount1 >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      资金库1: {record.amount1 >= 0 ? '+' : ''}{record.amount1.toFixed(2)}
                    </div>
                    <div className={`font-semibold ${record.amount2 >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      资金库2: {record.amount2 >= 0 ? '+' : ''}{record.amount2.toFixed(2)}
                    </div>
                      </div>
                    </div>
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

"use client";

import { useState } from "react";

export default function OnlinePaymentPage() {
  const [paymentData, setPaymentData] = useState({
    invoiceId: "",
    amount: "",
    method: "Card",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    fullName: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Online Payment</h1>
        <p className="mt-1 text-sm text-slate-500">Process payments for consultations and services</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Pending Payments</p>
          <p className="mt-2 text-3xl font-bold text-red-600">$4,820</p>
          <p className="mt-1 text-xs text-slate-500">12 invoices</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Paid Today</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">$2,450</p>
          <p className="mt-1 text-xs text-slate-500">8 transactions</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Revenue</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">$145,250</p>
          <p className="mt-1 text-xs text-emerald-600">↑ 8% vs last month</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-bold text-slate-900">Payment Form</h2>
        <form className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Invoice ID</label>
              <input
                type="text"
                name="invoiceId"
                value={paymentData.invoiceId}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="INV-2025-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Amount ($)</label>
              <input
                type="number"
                name="amount"
                value={paymentData.amount}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="150.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Payment Method</label>
            <select
              name="method"
              value={paymentData.method}
              onChange={handleChange}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="Card">Credit/Debit Card</option>
              <option value="Bank">Bank Transfer</option>
              <option value="Wallet">Digital Wallet</option>
            </select>
          </div>

          {paymentData.method === "Card" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700">Cardholder Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={paymentData.fullName}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Card Number</label>
                <input
                  type="text"
                  name="cardNumber"
                  value={paymentData.cardNumber}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="1234 5678 9012 3456"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Expiry Date</label>
                  <input
                    type="text"
                    name="expiryDate"
                    value={paymentData.expiryDate}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="MM/YY"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">CVV</label>
                  <input
                    type="text"
                    name="cvv"
                    value={paymentData.cvv}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="123"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              className="rounded-lg bg-teal-700 px-6 py-2 font-semibold text-white hover:bg-teal-800"
            >
              Pay Now
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-6 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

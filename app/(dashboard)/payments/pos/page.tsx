export default function POSBillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">POS Billing System</h1>
        <p className="mt-1 text-sm text-slate-500">Point of Sale billing and transaction management</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <h2 className="text-lg font-bold text-slate-900">Create Invoice</h2>
          <form className="mt-6 space-y-4">
            <input
              type="text"
              placeholder="Patient Name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option>Select Service</option>
              <option>Consultation - Doctor</option>
              <option>Lab Test</option>
              <option>Medicine</option>
            </select>
            <input
              type="number"
              placeholder="Quantity"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="number"
              placeholder="Price"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="button"
              className="w-full rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
            >
              Add Item
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <h2 className="text-lg font-bold text-slate-900">Invoice Summary</h2>
          <div className="mt-6 space-y-3">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold text-slate-900">$250.00</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-600">Tax (10%)</span>
              <span className="font-semibold text-slate-900">$25.00</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-600">Discount</span>
              <span className="font-semibold text-red-600">-$10.00</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="text-2xl font-bold text-red-600">$265.00</span>
            </div>
          </div>
          <button className="mt-6 w-full rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800">
            Generate Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

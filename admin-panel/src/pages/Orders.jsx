import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  RefreshCw,
  Copy,
  Check,
  Send,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import api from "../api";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [copied, setCopied] = useState(false);
  const [manualCredentials, setManualCredentials] = useState("");
  const [delivering, setDelivering] = useState(false);

  // Clear Orders Modal
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearScope, setClearScope] = useState("all"); // 'all', 'pending', 'cancelled'
  const [clearing, setClearing] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 25,
        status: statusFilter,
        search: search.trim() || undefined,
      };
      const res = await api.get("/orders", { params });
      setOrders(res.data.orders || []);
      setTotalCount(res.data.total || 0);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualDeliver = async (orderId) => {
    if (!manualCredentials.trim()) {
      alert("Please enter proxy credentials before sending.");
      return;
    }
    setDelivering(true);
    try {
      await api.post(`/orders/${orderId}/deliver`, {
        credentials: manualCredentials.trim(),
      });
      alert("Proxy delivered to customer successfully via Telegram!");
      setSelectedOrder(null);
      setManualCredentials("");
      fetchOrders();
    } catch (err) {
      alert("Delivery failed: " + (err.response?.data?.error || err.message));
    } finally {
      setDelivering(false);
    }
  };

  const handleClearOrders = async () => {
    setClearing(true);
    try {
      const res = await api.delete("/orders/clear", {
        params: { status: clearScope },
      });
      alert(res.data?.message || "Orders cleared successfully!");
      setClearModalOpen(false);
      setPage(1);
      fetchOrders();
    } catch (err) {
      alert(
        "Failed to clear orders: " + (err.response?.data?.error || err.message),
      );
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Customer Orders
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time audit log of Telegram purchases, payment confirmations,
            and delivered proxies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setClearModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-950/40 hover:bg-red-900/50 text-red-300 rounded-xl text-sm font-medium border border-red-800/50 transition"
          >
            <Trash2 className="w-4 h-4 text-red-400" /> Clear Orders
          </button>
          <button
            onClick={fetchOrders}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-sm font-medium border border-gray-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />{" "}
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#111827] p-4 rounded-2xl border border-gray-800">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order ID, @username, or Telegram ID..."
            className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white outline-none"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-gray-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#0b0f19] border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
          >
            <option value="all">All Orders</option>
            <option value="delivered">Delivered</option>
            <option value="paid">Paid</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="stock_pending">Stock Pending</option>
            <option value="pending">Pending Payment</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#0e1422] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3 px-5">Order ID</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Package</th>
                <th className="py-3 px-5">Amount</th>
                <th className="py-3 px-5">Woo / Gateway ID</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-normal">
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="py-12 text-center text-gray-500 text-sm"
                  >
                    No customer orders found matching your search.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-gray-800/30 transition">
                    <td className="py-3.5 px-5 font-mono text-xs font-medium text-blue-400">
                      {ord.orderId}
                      {ord.wooOrderId && (
                        <div className="text-[10px] text-gray-500">
                          Woo #{ord.wooOrderId}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-white text-xs">
                        {ord.telegramUsername
                          ? `@${ord.telegramUsername}`
                          : ord.telegramFirstName || "Customer"}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        ID: {ord.telegramId}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-gray-300">
                      <span className="font-semibold text-white">
                        {ord.productName || ord.brandId?.name || "Proxy"}
                      </span>{" "}
                      <span className="text-gray-400">
                        ({ord.variationName || ord.planId?.label || "Package"})
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-xs font-bold text-white font-mono">
                      {ord.amount} {ord.currency}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-xs text-gray-400">
                      {ord.wooOrderId
                        ? `Woo #${ord.wooOrderId}`
                        : ord.gatewayTransactionId || "—"}
                    </td>
                    <td className="py-3.5 px-5">
                      <OrderStatusBadge status={ord.status} />
                    </td>
                    <td className="py-3.5 px-5 text-xs text-gray-400">
                      {new Date(ord.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => {
                          setSelectedOrder(ord);
                          setManualCredentials("");
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition"
                        title="View order details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-400" /> Order
                Details: {selectedOrder.orderId}
              </h3>
              <OrderStatusBadge status={selectedOrder.status} />
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0b0f19] border border-gray-800/80">
                <div>
                  <span className="text-gray-500">Telegram Customer:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {selectedOrder.telegramUsername
                      ? `@${selectedOrder.telegramUsername}`
                      : selectedOrder.telegramFirstName || "User"}{" "}
                    <span className="text-gray-400 font-mono">
                      ({selectedOrder.telegramId})
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Total Paid:</span>
                  <p className="font-bold text-emerald-400 text-sm mt-0.5">
                    {selectedOrder.amount} {selectedOrder.currency}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0b0f19] border border-gray-800/80">
                <div>
                  <span className="text-gray-500">Brand / Package:</span>
                  <p className="font-medium text-white mt-0.5">
                    {selectedOrder.productName || selectedOrder.brandId?.name} —{" "}
                    {selectedOrder.variationName || selectedOrder.planId?.label}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Created At:</span>
                  <p className="text-gray-300 mt-0.5">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedOrder.wooOrderId && (
                <div>
                  <span className="text-gray-500">WooCommerce Order:</span>
                  <p className="font-mono text-blue-400 bg-[#0b0f19] p-2.5 rounded-lg border border-gray-800 mt-1 select-all">
                    Order #{selectedOrder.wooOrderId} (ipdokan.com)
                  </p>
                </div>
              )}

              {selectedOrder.deliveredCredentials ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 font-semibold">
                      Delivered Proxy Credentials:
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedOrder.deliveredCredentials)
                      }
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-emerald-300 bg-[#0b0f19] p-3 rounded-xl border border-emerald-500/20 overflow-x-auto whitespace-pre-wrap select-all">
                    {selectedOrder.deliveredCredentials}
                  </pre>
                  {selectedOrder.deliveredAt && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Delivered via Telegram bot at{" "}
                      {new Date(selectedOrder.deliveredAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2">
                  <span className="text-amber-300 font-semibold block">
                    Manual Proxy Fulfillment:
                  </span>
                  <textarea
                    rows="3"
                    value={manualCredentials}
                    onChange={(e) => setManualCredentials(e.target.value)}
                    placeholder="Paste credentials here (e.g. 192.168.1.1:8080:user:pass) to deliver to customer via Telegram..."
                    className="w-full bg-[#0b0f19] border border-gray-700 rounded-lg p-2 text-xs text-white outline-none resize-none font-mono"
                  />
                  <button
                    onClick={() => handleManualDeliver(selectedOrder._id)}
                    disabled={delivering}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {delivering ? "Sending..." : "Send to Customer on Telegram"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-800">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR ORDERS MODAL */}
      {clearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-red-900/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/60 flex items-center justify-center flex-shrink-0 text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Clear Customer Orders
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Choose which orders you want to permanently delete from the
                  database:
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-[#0b0f19] border border-gray-800 cursor-pointer hover:border-gray-700 transition">
                <input
                  type="radio"
                  name="clearScope"
                  value="all"
                  checked={clearScope === "all"}
                  onChange={(e) => setClearScope(e.target.value)}
                  className="text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Delete ALL Orders
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Completely clears the entire order history
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-[#0b0f19] border border-gray-800 cursor-pointer hover:border-gray-700 transition">
                <input
                  type="radio"
                  name="clearScope"
                  value="pending"
                  checked={clearScope === "pending"}
                  onChange={(e) => setClearScope(e.target.value)}
                  className="text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Delete Pending Payment Only
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Deletes abandoned or unpaid orders
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-[#0b0f19] border border-gray-800 cursor-pointer hover:border-gray-700 transition">
                <input
                  type="radio"
                  name="clearScope"
                  value="cancelled"
                  checked={clearScope === "cancelled"}
                  onChange={(e) => setClearScope(e.target.value)}
                  className="text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Delete Cancelled & Failed Only
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Removes cancelled transactions
                  </span>
                </div>
              </label>
            </div>

            <p className="text-[11px] text-red-400/80 bg-red-950/20 p-2.5 rounded-lg border border-red-900/30">
              ⚠️ <b>Warning:</b> This action cannot be undone!
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                disabled={clearing}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearOrders}
                disabled={clearing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {clearing ? "Clearing..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderStatusBadge({ status }) {
  switch (status) {
    case "delivered":
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> Delivered
        </span>
      );
    case "paid":
    case "processing":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
      );
    case "stock_pending":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3" /> Stock Pending
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3 h-3" /> {status}
        </span>
      );
  }
}

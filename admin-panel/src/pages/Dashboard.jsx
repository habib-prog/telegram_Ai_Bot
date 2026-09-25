import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import api from '../api';

export default function Dashboard({ setActiveTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/stats');
      setStats(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Live metrics across sales, proxy stock, and Telegram orders</p>
        </div>
        <button
          onClick={fetchStats}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-sm font-medium border border-gray-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Revenue */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white">
              {stats?.revenue?.total?.toLocaleString() || 0} <span className="text-xs text-gray-400 font-normal">BDT</span>
            </h3>
            <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Today: {stats?.revenue?.today?.toLocaleString() || 0} BDT
            </p>
          </div>
        </div>

        {/* Total Paid Orders */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed Orders</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white">{stats?.orders?.totalPaid || 0}</h3>
            <p className="text-xs text-gray-400 mt-1.5">
              Today: <strong className="text-white">{stats?.orders?.today || 0}</strong> | Pending: <strong className="text-amber-400">{stats?.orders?.pending || 0}</strong>
            </p>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Telegram Users</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white">{stats?.customers || 0}</h3>
            <p className="text-xs text-gray-400 mt-1.5">Registered Telegram buyers</p>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Low Stock Plans</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white">{stats?.lowStockAlerts?.length || 0}</h3>
            <p className="text-xs text-amber-400 mt-1.5 font-medium">
              {stats?.lowStockAlerts?.length ? 'Needs immediate restock' : 'All plans adequately stocked'}
            </p>
          </div>
        </div>
      </div>

      {/* Low Stock Banner Alert */}
      {stats?.lowStockAlerts && stats.lowStockAlerts.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-300">
                  Low Stock Warning ({stats.lowStockAlerts.length} packages below threshold)
                </h3>
                <p className="text-xs text-amber-400/80 mt-1">
                  The following packages have fewer than 5 available proxy credentials. Restock to prevent delays in automated Telegram delivery:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stats.lowStockAlerts.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-200 text-xs font-medium"
                    >
                      {item.brandEmoji} {item.brandName} - {item.planLabel}:
                      <strong className="text-white ml-1">{item.availableStock} left</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('stock')}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-bold rounded-lg transition whitespace-nowrap"
            >
              Add Stock
            </button>
          </div>
        </div>
      )}

      {/* Recent Orders Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Recent Customer Orders</h2>
          <button
            onClick={() => setActiveTab('orders')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            View all orders <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#0e1422] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3 px-5">Order ID</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Package</th>
                <th className="py-3 px-5">Amount</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-normal">
              {stats?.recentOrders?.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500 text-sm">
                    No orders placed yet.
                  </td>
                </tr>
              ) : (
                stats?.recentOrders?.map((ord) => (
                  <tr key={ord._id} className="hover:bg-gray-800/30 transition">
                    <td className="py-3.5 px-5 font-mono text-xs text-gray-300">{ord.orderId}</td>
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-white text-xs">
                        {ord.telegramUsername ? `@${ord.telegramUsername}` : ord.telegramFirstName || 'User'}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">ID: {ord.telegramId}</div>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-gray-300">
                      {ord.brandId?.name || 'Proxy'} — {ord.planId?.label || 'Plan'}
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-white text-xs">
                      {ord.amount} {ord.currency}
                    </td>
                    <td className="py-3.5 px-5">
                      <StatusBadge status={ord.status} />
                    </td>
                    <td className="py-3.5 px-5 text-xs text-gray-400">
                      {new Date(ord.createdAt).toLocaleDateString()} {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  switch (status) {
    case 'delivered':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> Delivered
        </span>
      );
    case 'paid':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
      );
    case 'stock_pending':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3" /> Stock Pending
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3 h-3" /> {status}
        </span>
      );
  }
}

import React, { useState, useEffect } from 'react';
import {
  Database,
  UploadCloud,
  Trash2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import api from '../api';

export default function Stock() {
  const [brands, setBrands] = useState([]);
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Bulk Upload Modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    brandId: '',
    planId: '',
    credentials: '',
    batchNote: '',
  });
  const [uploading, setUploading] = useState(false);

  // Credential view toggle
  const [revealedIds, setRevealedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, pRes, sRes] = await Promise.all([
        api.get('/brands'),
        api.get('/plans'),
        api.get('/stock/summary'),
      ]);
      setBrands(bRes.data);
      setPlans(pRes.data);
      setSummary(sRes.data.summary || []);
    } catch (err) {
      console.error('Failed to load stock data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockList = async () => {
    try {
      const params = {};
      if (filterBrand !== 'all') params.brandId = filterBrand;
      if (filterPlan !== 'all') params.planId = filterPlan;
      if (filterStatus !== 'all') params.isUsed = filterStatus === 'used';

      const res = await api.get('/stock', { params });
      setStockItems(res.data.items || []);
      setTotalCount(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load stock list:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchStockList();
  }, [filterBrand, filterPlan, filterStatus]);

  const handleOpenUpload = (presetBrandId = '', presetPlanId = '') => {
    const brandId = presetBrandId || brands[0]?._id || '';
    const brandPlans = plans.filter((p) => (p.brandId?._id || p.brandId) === brandId);
    const planId = presetPlanId || brandPlans[0]?._id || '';

    setUploadForm({
      brandId,
      planId,
      credentials: '',
      batchNote: '',
    });
    setUploadModalOpen(true);
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.brandId || !uploadForm.planId || !uploadForm.credentials.trim()) {
      alert('Please select a brand, plan, and provide at least one credential.');
      return;
    }

    setUploading(true);
    try {
      const res = await api.post('/stock/bulk', uploadForm);
      alert(`✅ Successfully added ${res.data.addedCount} credentials into inventory!`);
      setUploadModalOpen(false);
      fetchData();
      fetchStockList();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to bulk add stock');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this unused credential?')) return;
    try {
      await api.delete(`/stock/${id}`);
      fetchStockList();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Cannot delete item');
    }
  };

  const toggleReveal = (id) => {
    const next = new Set(revealedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRevealedIds(next);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadForm((prev) => ({
        ...prev,
        credentials: event.target.result,
        batchNote: prev.batchNote || `Imported from ${file.name}`,
      }));
    };
    reader.readAsText(file);
  };

  const filteredUploadPlans = plans.filter(
    (p) => (p.brandId?._id || p.brandId) === uploadForm.brandId
  );

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Stock & Credential Inventory</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage available proxy credentials, monitor low stock, and bulk import new inventory
          </p>
        </div>
        <button
          onClick={() => handleOpenUpload()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/20 transition"
        >
          <UploadCloud className="w-4 h-4" /> Bulk Import Stock
        </button>
      </div>

      {/* SECTION 1: INVENTORY SUMMARY CARDS */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" /> Stock Status by Plan ({summary.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((item, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition-all ${
                item.isLowStock
                  ? 'bg-amber-950/20 border-amber-800/50'
                  : 'bg-[#111827] border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    {item.brandEmoji} {item.brandName}
                  </span>
                  <h3 className="font-bold text-white text-base mt-1">{item.planLabel}</h3>
                  <p className="text-xs text-emerald-400 font-medium mt-0.5">
                    {item.price} {item.currency}
                  </p>
                </div>
                {item.isLowStock ? (
                  <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400" title="Low stock (< 5)">
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                ) : (
                  <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                )}
              </div>

              {/* Progress & Counts */}
              <div className="mt-4 pt-4 border-t border-gray-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-400">Available:</span>{' '}
                  <strong className={`text-sm ${item.isLowStock ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {item.availableStock}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-400">Sold:</span>{' '}
                  <strong className="text-white text-sm">{item.usedStock}</strong>
                </div>
                <button
                  onClick={() => handleOpenUpload(item.brandId, item.planId)}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded-lg text-xs font-medium transition"
                >
                  + Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: CREDENTIALS REPOSITORY TABLE */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white">Proxy Credentials ({totalCount})</h2>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterBrand}
              onChange={(e) => {
                setFilterBrand(e.target.value);
                setFilterPlan('all');
              }}
              className="bg-[#111827] border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 outline-none"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.emoji} {b.name}
                </option>
              ))}
            </select>

            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="bg-[#111827] border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 outline-none"
            >
              <option value="all">All Plans</option>
              {plans
                .filter((p) => filterBrand === 'all' || (p.brandId?._id || p.brandId) === filterBrand)
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.label}
                  </option>
                ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#111827] border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 outline-none"
            >
              <option value="all">All Status</option>
              <option value="unused">Unused (In Stock)</option>
              <option value="used">Used (Delivered)</option>
            </select>
          </div>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#0e1422] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="py-3 px-5">Brand / Plan</th>
                  <th className="py-3 px-5">Credentials</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Assigned Customer</th>
                  <th className="py-3 px-5">Batch Note</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-normal">
                {stockItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-gray-500 text-sm">
                      No stock items found matching your filters.
                    </td>
                  </tr>
                ) : (
                  stockItems.map((item) => {
                    const isRevealed = revealedIds.has(item._id);
                    return (
                      <tr key={item._id} className="hover:bg-gray-800/30 transition">
                        <td className="py-3.5 px-5">
                          <div className="font-medium text-white text-xs">
                            {item.brandId?.name || 'Unknown'}
                          </div>
                          <div className="text-[11px] text-gray-500">{item.planId?.label || 'Plan'}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="bg-[#0b0f19] px-2.5 py-1 rounded-lg border border-gray-800 max-w-xs truncate text-gray-200 select-all">
                              {isRevealed
                                ? item.credentials
                                : '••••••••••••••••••••••••••••••••••••••'}
                            </span>
                            <button
                              onClick={() => toggleReveal(item._id)}
                              className="p-1 text-gray-400 hover:text-white"
                              title={isRevealed ? 'Mask' : 'Reveal'}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-blue-400" />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          {item.isUsed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700/30 text-gray-400 border border-gray-700">
                              Used / Sold
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Available
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-xs text-gray-400">
                          {item.assignedToTelegramId ? (
                            <span className="font-mono text-blue-400">
                              ID: {item.assignedToTelegramId}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-xs text-gray-500 max-w-xs truncate">
                          {item.batchNote || '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {!item.isUsed && (
                            <button
                              onClick={() => handleDeleteItem(item._id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
                              title="Delete unused stock item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BULK UPLOAD MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-400" /> Bulk Import Proxy Credentials
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Select destination brand and package, then paste credentials line-by-line or upload a text file.
            </p>

            <form onSubmit={handleBulkUpload} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Brand *</label>
                  <select
                    required
                    value={uploadForm.brandId}
                    onChange={(e) => {
                      const brandId = e.target.value;
                      const brandPlans = plans.filter(
                        (p) => (p.brandId?._id || p.brandId) === brandId
                      );
                      setUploadForm({
                        ...uploadForm,
                        brandId,
                        planId: brandPlans[0]?._id || '',
                      });
                    }}
                    className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  >
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.emoji} {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Plan Package *</label>
                  <select
                    required
                    value={uploadForm.planId}
                    onChange={(e) => setUploadForm({ ...uploadForm, planId: e.target.value })}
                    className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  >
                    {filteredUploadPlans.length === 0 ? (
                      <option disabled value="">
                        No plans available for this brand
                      </option>
                    ) : (
                      filteredUploadPlans.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.label} ({p.price} {p.currency})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-400">
                    Proxy Credentials (one per line) *
                  </label>
                  <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-medium">
                    📁 Or upload .txt / .csv
                    <input
                      type="file"
                      accept=".txt,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows="7"
                  required
                  value={uploadForm.credentials}
                  onChange={(e) => setUploadForm({ ...uploadForm, credentials: e.target.value })}
                  placeholder={`192.168.1.1:8080:user1:pass1\n192.168.1.2:8080:user2:pass2\n192.168.1.3:8080:user3:pass3`}
                  className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl p-3 text-xs font-mono text-gray-200 outline-none resize-none leading-relaxed"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Lines starting with # or empty lines are automatically ignored.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Batch Note</label>
                <input
                  type="text"
                  value={uploadForm.batchNote}
                  onChange={(e) => setUploadForm({ ...uploadForm, batchNote: e.target.value })}
                  placeholder="e.g. Supplier Batch A - March 2026"
                  className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || filteredUploadPlans.length === 0}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/30 disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving Stock...
                    </>
                  ) : (
                    'Add Credentials to Stock'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

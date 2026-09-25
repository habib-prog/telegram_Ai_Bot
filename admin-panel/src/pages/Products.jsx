import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Layers,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import api from "../api";

export default function Products() {
  const [brands, setBrands] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals state
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [brandForm, setBrandForm] = useState({
    name: "",
    emoji: "🌐",
    description: "",
    displayOrder: 0,
    isActive: true,
  });

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    brandId: "",
    label: "",
    price: "",
    currency: "BDT",
    durationDays: 30,
    displayOrder: 0,
    isActive: true,
  });

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [bRes, pRes] = await Promise.all([
        api.get("/brands"),
        api.get("/plans"),
      ]);
      setBrands(bRes.data);
      setPlans(pRes.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load brands & plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Brand Actions ---
  const handleOpenBrandModal = (brand = null) => {
    if (brand) {
      setEditingBrand(brand);
      setBrandForm({
        name: brand.name,
        emoji: brand.emoji || "🌐",
        description: brand.description || "",
        displayOrder: brand.displayOrder || 0,
        isActive: brand.isActive,
      });
    } else {
      setEditingBrand(null);
      setBrandForm({
        name: "",
        emoji: "🌐",
        description: "",
        displayOrder: brands.length + 1,
        isActive: true,
      });
    }
    setBrandModalOpen(true);
  };

  const handleSaveBrand = async (e) => {
    e.preventDefault();
    try {
      if (editingBrand) {
        await api.put(`/brands/${editingBrand._id}`, brandForm);
      } else {
        await api.post("/brands", brandForm);
      }
      setBrandModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Error saving brand");
    }
  };

  const handleDeleteBrand = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete brand "${name}"?`))
      return;
    try {
      await api.delete(`/brands/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete brand");
    }
  };

  const toggleBrandActive = async (brand) => {
    try {
      await api.put(`/brands/${brand._id}`, { isActive: !brand.isActive });
      setBrands(
        brands.map((b) =>
          b._id === brand._id ? { ...b, isActive: !b.isActive } : b,
        ),
      );
    } catch (err) {
      alert("Error updating brand status");
    }
  };

  // --- Plan Actions ---
  const handleOpenPlanModal = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        brandId: plan.brandId?._id || plan.brandId,
        label: plan.label,
        price: plan.price,
        currency: plan.currency || "BDT",
        durationDays: plan.durationDays || 30,
        displayOrder: plan.displayOrder || 0,
        isActive: plan.isActive,
      });
    } else {
      setEditingPlan(null);
      setPlanForm({
        brandId:
          selectedBrandFilter !== "all"
            ? selectedBrandFilter
            : brands[0]?._id || "",
        label: "",
        price: "",
        currency: "BDT",
        durationDays: 30,
        displayOrder: 1,
        isActive: true,
      });
    }
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      if (editingPlan) {
        await api.put(`/plans/${editingPlan._id}`, planForm);
      } else {
        await api.post("/plans", planForm);
      }
      setPlanModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Error saving plan");
    }
  };

  const handleDeletePlan = async (id, label) => {
    if (!window.confirm(`Delete plan "${label}"?`)) return;
    try {
      await api.delete(`/plans/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete plan");
    }
  };

  const togglePlanActive = async (plan) => {
    try {
      await api.put(`/plans/${plan._id}`, { isActive: !plan.isActive });
      setPlans(
        plans.map((p) =>
          p._id === plan._id ? { ...p, isActive: !p.isActive } : p,
        ),
      );
    } catch (err) {
      alert("Error updating plan status");
    }
  };

  const filteredPlans =
    selectedBrandFilter === "all"
      ? plans
      : plans.filter(
          (p) => (p.brandId?._id || p.brandId) === selectedBrandFilter,
        );

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Proxy Brands & Plans
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure proxy vendors, available packages, bandwidth, and pricing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={async () => {
              if (loading) return;
              setLoading(true);
              try {
                const res = await api.post("/woocommerce/sync");
                alert(res.data?.message || "Sync successful!");
                fetchData();
              } catch (err) {
                alert(
                  "Sync failed: " + (err.response?.data?.error || err.message),
                );
                setLoading(false);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />{" "}
            Sync with WooCommerce
          </button>
          <button
            onClick={() => handleOpenBrandModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/20 transition"
          >
            <Plus className="w-4 h-4" /> Add Brand
          </button>
          <button
            onClick={() => handleOpenPlanModal()}
            disabled={brands.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Plan
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: BRANDS GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" /> Active Brands (
            {brands.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <div
              key={brand._id}
              className={`p-5 rounded-2xl border transition-all ${
                brand.isActive
                  ? "bg-[#111827] border-gray-800"
                  : "bg-[#0f1420] border-gray-800/40 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{brand.emoji}</span>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">
                      {brand.name}
                    </h3>
                    <span className="text-[11px] text-gray-500">
                      Order: {brand.displayOrder}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleBrandActive(brand)}
                    title={
                      brand.isActive
                        ? "Active (click to disable)"
                        : "Disabled (click to activate)"
                    }
                    className={`p-1.5 rounded-lg transition ${brand.isActive ? "text-emerald-400 hover:bg-emerald-500/10" : "text-gray-500 hover:bg-gray-800"}`}
                  >
                    {brand.isActive ? (
                      <ToggleRight className="w-6 h-6" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenBrandModal(brand)}
                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBrand(brand._id, brand.name)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-3 line-clamp-2">
                {brand.description || "No description provided."}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: PLANS TABLE */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            📦 Plans Catalog ({filteredPlans.length})
          </h2>

          {/* Filter by Brand */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">
              Filter by Brand:
            </span>
            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className="bg-[#111827] border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.emoji} {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#0e1422] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="py-3 px-5">Brand</th>
                  <th className="py-3 px-5">Plan Label</th>
                  <th className="py-3 px-5">Price</th>
                  <th className="py-3 px-5">Validity</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-normal">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="py-8 text-center text-gray-500 text-sm"
                    >
                      No plans found. Click "+ Add Plan" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan) => (
                    <tr
                      key={plan._id}
                      className="hover:bg-gray-800/30 transition"
                    >
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1.5 font-medium text-white text-xs">
                          {plan.brandId?.emoji || "🌐"}{" "}
                          {plan.brandId?.name || "Unknown"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-white text-xs">
                        {plan.label}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-emerald-400 font-bold">
                        {plan.price} {plan.currency}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-gray-400">
                        {plan.durationDays} Days
                      </td>
                      <td className="py-3.5 px-5">
                        <button
                          onClick={() => togglePlanActive(plan)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            plan.isActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-gray-700/30 text-gray-400 border border-gray-700"
                          }`}
                        >
                          {plan.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenPlanModal(plan)}
                            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleDeletePlan(plan._id, plan.label)
                            }
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BRAND MODAL */}
      {brandModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingBrand ? "Edit Proxy Brand" : "Add New Proxy Brand"}
            </h3>

            <form onSubmit={handleSaveBrand} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={brandForm.name}
                  onChange={(e) =>
                    setBrandForm({ ...brandForm, name: e.target.value })
                  }
                  placeholder="e.g. 9Proxy"
                  className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Emoji / Logo
                  </label>
                  <input
                    type="text"
                    value={brandForm.emoji}
                    onChange={(e) =>
                      setBrandForm({ ...brandForm, emoji: e.target.value })
                    }
                    placeholder="⚡"
                    className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={brandForm.displayOrder}
                    onChange={(e) =>
                      setBrandForm({
                        ...brandForm,
                        displayOrder: e.target.value,
                      })
                    }
                    className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  value={brandForm.description}
                  onChange={(e) =>
                    setBrandForm({ ...brandForm, description: e.target.value })
                  }
                  placeholder="Fast, clean residential proxies..."
                  className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="brandActive"
                  checked={brandForm.isActive}
                  onChange={(e) =>
                    setBrandForm({ ...brandForm, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-blue-600 bg-gray-900 border-gray-700"
                />
                <label htmlFor="brandActive" className="text-sm text-gray-300">
                  Visible to Telegram customers
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setBrandModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-600/30"
                >
                  Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PLAN MODAL */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingPlan ? "Edit Plan" : "Add New Plan"}
            </h3>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Brand *
                </label>
                <select
                  required
                  value={planForm.brandId}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, brandId: e.target.value })
                  }
                  className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                >
                  <option value="" disabled>
                    Select Brand
                  </option>
                  {brands.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.emoji} {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Plan Label *
                </label>
                <input
                  type="text"
                  required
                  value={planForm.label}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, label: e.target.value })
                  }
                  placeholder="e.g. 5 GB Residential (30 Days)"
                  className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planForm.price}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, price: e.target.value })
                    }
                    placeholder="1500"
                    className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none text-right font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={planForm.currency}
                    onChange={(e) =>
                      setPlanForm({
                        ...planForm,
                        currency: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="BDT"
                    className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none text-center font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    value={planForm.durationDays}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, durationDays: e.target.value })
                    }
                    className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={planForm.displayOrder}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, displayOrder: e.target.value })
                    }
                    className="w-full bg-[#0b0f19] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none text-center"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="planActive"
                  checked={planForm.isActive}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-emerald-600 bg-gray-900 border-gray-700"
                />
                <label htmlFor="planActive" className="text-sm text-gray-300">
                  Visible & purchasable in Telegram
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/30"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

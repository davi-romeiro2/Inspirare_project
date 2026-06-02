// Pricing plans helper shared by admin and user frontends.
// Exposes window.InspirarePlans with API + price math utilities.

(function () {
  'use strict';

  // --- Price math (pure functions, reusable on both sides) -----------------

  function formatCurrency(value) {
    var n = Number(value);
    if (isNaN(n)) n = 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function todayStr(today) {
    var d = today || new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function isDiscountActive(plan, today) {
    if (!plan || !plan.discount_active || !plan.discount_percent || plan.discount_percent <= 0) return false;
    var t = todayStr(today);
    if (plan.discount_start && t < plan.discount_start) return false;
    if (plan.discount_end && t > plan.discount_end) return false;
    return true;
  }

  function applyDiscount(plan, today) {
    var base = Number(plan.base_price);
    if (isDiscountActive(plan, today)) {
      return base * (1 - Number(plan.discount_percent) / 100);
    }
    return base;
  }

  function perSessionPrice(plan, today) {
    var n = Number(plan.consultations_per_month);
    if (!n || n <= 0) return 0;
    return applyDiscount(plan, today) / n;
  }

  // --- API calls (thin wrappers over InspirareAuth.api) ---------------------

  function loadPlans() {
    return InspirareAuth.api('/plans').then(function (data) { return data.plans || []; });
  }

  function loadPlan(slug) {
    return InspirareAuth.api('/plans/' + encodeURIComponent(slug))
      .then(function (data) { return data.plan; });
  }

  function createPlan(payload) {
    return InspirareAuth.api('/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(function (data) { return data.plan; });
  }

  function updatePlan(id, payload) {
    return InspirareAuth.api('/plans/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then(function (data) { return data.plan; });
  }

  function deletePlan(id) {
    return InspirareAuth.api('/plans/' + encodeURIComponent(id), {
      method: 'DELETE',
    });
  }

  window.InspirarePlans = {
    formatCurrency: formatCurrency,
    todayStr: todayStr,
    isDiscountActive: isDiscountActive,
    applyDiscount: applyDiscount,
    perSessionPrice: perSessionPrice,
    loadPlans: loadPlans,
    loadPlan: loadPlan,
    createPlan: createPlan,
    updatePlan: updatePlan,
    deletePlan: deletePlan,
  };
})();

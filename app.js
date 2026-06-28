const data = window.COFFEE_ORDERS || [];
const meta = window.COFFEE_META || {};

const $ = (id) => document.getElementById(id);
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const currency2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
let filtered = [...data];
let sortState = { key: "orderDate", dir: "asc" };
let charts = {};

Chart.defaults.color = "#9fb1cc";
Chart.defaults.borderColor = "rgba(255,255,255,.10)";
Chart.defaults.font.family = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";

const palette = ["#1d9bf0", "#f97316", "#a3a3a3", "#facc15", "#4fd1c5", "#8b5cf6", "#5ee0a0", "#ff6b7a"];

function uniqueSorted(key) {
  return [...new Set(data.map(d => d[key]).filter(v => v !== undefined && v !== null && v !== ""))].sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true}));
}
function setOptions(select, values, label = "All") {
  select.innerHTML = `<option value="">${label}</option>` + values.map(v => `<option value="${String(v).replaceAll('"','&quot;')}">${v}</option>`).join("");
}
function initFilters() {
  setOptions($("yearFilter"), uniqueSorted("year"), "All years");
  setOptions($("countryFilter"), uniqueSorted("country"), "All countries");
  setOptions($("coffeeFilter"), uniqueSorted("coffeeTypeName"), "All coffee types");
  setOptions($("roastFilter"), uniqueSorted("roastTypeName"), "All roasts");
  setOptions($("sizeFilter"), uniqueSorted("sizeKg").map(v => `${v} kg`), "All sizes");
  setOptions($("loyaltyFilter"), uniqueSorted("loyaltyCard"), "All loyalty status");

  ["yearFilter", "countryFilter", "coffeeFilter", "roastFilter", "sizeFilter", "loyaltyFilter"].forEach(id => {
    $(id).addEventListener("input", applyFilters);
    $(id).addEventListener("change", applyFilters);
  });

  $("resetFilters").addEventListener("click", resetFilters);
  $("resetFiltersTop").addEventListener("click", resetFilters);
  $("scrollToDashboard").addEventListener("click", () => $("dashboard").scrollIntoView({ behavior: "smooth" }));
  $("downloadCsv").addEventListener("click", downloadFilteredCsv);

  document.querySelectorAll("th[data-sort]").forEach(th =>
    th.addEventListener("click", () => sortTable(th.dataset.sort))
  );
}
function resetFilters() {
  ["yearFilter", "countryFilter", "coffeeFilter", "roastFilter", "sizeFilter", "loyaltyFilter"].forEach(id => {
    $(id).value = "";
  });

  applyFilters();
}

function applyFilters() {
  const year = $("yearFilter").value;
  const country = $("countryFilter").value;
  const coffee = $("coffeeFilter").value;
  const roast = $("roastFilter").value;
  const size = $("sizeFilter").value.replace(" kg", "");
  const loyalty = $("loyaltyFilter").value;

  filtered = data.filter(d => {
    if (year && String(d.year) !== year) return false;
    if (country && d.country !== country) return false;
    if (coffee && d.coffeeTypeName !== coffee) return false;
    if (roast && d.roastTypeName !== roast) return false;
    if (size && String(d.sizeKg) !== size) return false;
    if (loyalty && d.loyaltyCard !== loyalty) return false;

    return true;
  });

  updateDashboard();
}
function sum(arr, key) { return arr.reduce((acc, d) => acc + (Number(d[key]) || 0), 0); }
function groupBy(arr, key, valueKey="sales") {
  const map = new Map();
  arr.forEach(d => map.set(d[key], (map.get(d[key]) || 0) + (Number(d[valueKey]) || 0)));
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
}

function updateHero() {
  $("heroTotalSales").textContent = currency.format(meta.totalSales || sum(data,"sales"));
  $("heroRows").textContent = numberFmt.format(data.length);
  $("heroYears").textContent = uniqueSorted("year").length;
  $("heroCountries").textContent = uniqueSorted("country").length;
  const tags = ["Order Date", "Sales", "Profit", "Country", "Customer", "Coffee Type", "Roast", "Size", "Loyalty Card", "Quantity", "Unit Price", "Product ID"];
  $("fieldTags").innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join("");
}
function updateKpis() {
  const totalSales = sum(filtered, "sales");
  const totalProfit = sum(filtered, "profit");
  const totalQty = sum(filtered, "quantity");
  const orders = filtered.length;
  const countries = groupBy(filtered, "country");
  const topCountry = countries[0];
  $("kpiSales").textContent = currency.format(totalSales);
  $("kpiProfit").textContent = currency.format(totalProfit);
  $("kpiOrders").textContent = numberFmt.format(orders);
  $("kpiUnits").textContent = numberFmt.format(totalQty);
  $("kpiAov").textContent = orders ? currency2.format(totalSales / orders) : "$0";
  $("kpiCountry").textContent = topCountry ? topCountry.name : "—";
  $("kpiCountryNote").textContent = topCountry ? `${currency.format(topCountry.value)} sales` : "No data";
  $("kpiSalesNote").textContent = `${numberFmt.format(filtered.length)} of ${numberFmt.format(data.length)} rows`;
}
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
function makeChart(id, config) {
  destroyChart(id);
  charts[id] = new Chart($(id), config);
}
function monthlyTrend(arr) {
  const coffeeTypes = uniqueSorted("coffeeTypeName");
  const monthSet = new Set(arr.map(d => `${d.year}-${String(d.month).padStart(2,"0")}`));
  const keys = [...monthSet].sort();
  const labels = keys.map(k => {
    const [y,m] = k.split("-");
    return `${months[Number(m)-1]} ${y}`;
  });
  const datasets = coffeeTypes.map((type, i) => ({
    label: type,
    data: keys.map(k => arr.filter(d => d.coffeeTypeName === type && `${d.year}-${String(d.month).padStart(2,"0")}` === k).reduce((a,d) => a + d.sales, 0)),
    borderColor: palette[i % palette.length],
    backgroundColor: palette[i % palette.length],
    tension: .32,
    pointRadius: 2,
    borderWidth: 2
  }));
  return { labels, datasets };
}

function updateCharts() {
  const trend = monthlyTrend(filtered);

  makeChart("salesTrendChart", {
    type: "line",
    data: trend,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: c => `${c.dataset.label}: ${currency2.format(c.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 16 }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => currency.format(v)
          }
        }
      }
    }
  });

  const customers = groupByCustomer(filtered);

  makeChart("customerChart", {
    type: "bar",
    data: {
      labels: customers.map(d => d.name),
      datasets: [{
        label: "Sales",
        data: customers.map(d => d.value),
        backgroundColor: "rgba(94,224,160,.78)",
        borderRadius: 10
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => currency2.format(c.parsed.x)
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: v => currency.format(v)
          }
        }
      }
    }
  });

  const country = groupBy(filtered, "country").reverse();

  makeChart("countryChart", {
    type: "bar",
    data: {
      labels: country.map(d => d.name),
      datasets: [{
        label: "Sales",
        data: country.map(d => d.value),
        backgroundColor: "rgba(29,155,240,.78)",
        borderRadius: 10
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => currency2.format(c.parsed.x)
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: v => currency.format(v)
          }
        }
      }
    }
  });
}
function groupByCustomer(arr) {
  const map = new Map();

  arr.forEach(d => {
    const name = d.customerName || "Unknown";
    map.set(name, (map.get(name) || 0) + (Number(d.sales) || 0));
  });

  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .reverse();
}
function sortTable(key) {
  if (sortState.key === key) sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
  else sortState = { key, dir: "asc" };
  updateTable();
}
function sortedRows() {
  const rows = [...filtered];
  rows.sort((a,b) => {
    const av = a[sortState.key];
    const bv = b[sortState.key];
    if (typeof av === "number" && typeof bv === "number") return sortState.dir === "asc" ? av - bv : bv - av;
    return sortState.dir === "asc" ? String(av).localeCompare(String(bv), undefined, {numeric:true}) : String(bv).localeCompare(String(av), undefined, {numeric:true});
  });
  return rows;
}
function updateTable() {
  const rows = sortedRows();
  const shown = rows.slice(0, 120);
  $("ordersTableBody").innerHTML = shown.map(d => `
    <tr>
      <td>${d.orderDate}</td><td>${d.orderId}</td><td>${d.customerName}</td><td>${d.country}</td><td>${d.coffeeTypeName}</td><td>${d.roastTypeName}</td><td>${d.sizeKg} kg</td><td>${d.quantity}</td><td class="value-money">${currency2.format(d.sales)}</td><td class="value-good">${currency2.format(d.profit)}</td>
    </tr>`).join("");
  $("tableSummary").textContent = `Showing ${numberFmt.format(Math.min(rows.length, 120))} of ${numberFmt.format(rows.length)} filtered rows. Click column headers to sort.`;
}
function updateDashboard() {
  updateKpis();
  updateCharts();
  updateTable();
}
function downloadFilteredCsv() {
  const headers = ["Order Date","Order ID","Customer","Country","City","Coffee Type","Roast Type","Size Kg","Quantity","Unit Price","Sales","Profit","Loyalty Card"];
  const rows = sortedRows().map(d => [d.orderDate,d.orderId,d.customerName,d.country,d.city,d.coffeeTypeName,d.roastTypeName,d.sizeKg,d.quantity,d.unitPrice,d.sales,d.profit,d.loyaltyCard]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "filtered-coffee-orders.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

initFilters();
updateHero();
applyFilters();

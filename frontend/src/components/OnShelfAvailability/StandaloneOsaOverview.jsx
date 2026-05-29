import React, { useState, useEffect, useMemo, useContext } from "react";
import axiosInstance from "../../api/axiosInstance";
import SnapshotOverview from "../CommonLayout/SnapshotOverview";
import { FilterContext } from "../../utils/FilterContext";
import { LayoutGrid, Layers, MapPin, PieChart } from "lucide-react";
import { Skeleton } from "@mui/material";

export default function StandaloneOsaOverview({ filters, loading: parentLoading }) {
  const [dataLoading, setDataLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [metroData, setMetroData] = useState(null);
  const [marketShareData, setMarketShareData] = useState(null);
  const [osaTrendsData, setOsaTrendsData] = useState(null);
  const [msTrendsData, setMsTrendsData] = useState(null);

  // Derive display name from the logged-in user's dbName
  const dbDisplayName = useMemo(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('user'));
      if (u?.dbName) {
        if (u.dbName.toLowerCase() === 'mamaearth') {
          return 'The Derma Co.';
        }
        if (u.dbName.toLowerCase() === 'hm_zydus') {
          return 'Zydus';
        }
        return u.dbName
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
      }
    } catch { /* ignore */ }
    return 'Our';
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);

      try {
        const buildParams = () => {
          const params = new URLSearchParams();
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== 'All' && value !== '') {
              if (Array.isArray(value)) {
                if (value.length > 0) {
                  value.forEach(v => params.append(key, v));
                }
              } else {
                params.append(key, value);
              }
            }
          });
          // Ensure defaults for required fields if not present
          if (!params.has('platform')) params.append('platform', 'All');
          if (!params.has('brand')) params.append('brand', 'All');
          if (!params.has('location')) params.append('location', 'All');
          return params;
        };

        const osaParams = buildParams();
        // Only force ownBrandsOnly if no specific brand is selected
        if (!osaParams.has('brand') || osaParams.get('brand') === 'All') {
          osaParams.append('ownBrandsOnly', 'true');
        }

        const msParams = buildParams();

        const [overviewRes, metroRes, msRes, osaTrendsRes, msTrendsRes] = await Promise.allSettled([
          axiosInstance.get(`/availability-analysis/absolute-osa/availability-overview?${osaParams.toString()}`),
          axiosInstance.get(`/availability-analysis/absolute-osa/metro-city-stock-availability?${osaParams.toString()}`),
          axiosInstance.get(`/market-share/cross-platform?${msParams.toString()}`),
          axiosInstance.get(`/availability-analysis/kpi-trends?${osaParams.toString()}`),
          axiosInstance.get(`/market-share/trends?${msParams.toString()}`)
        ]);

        if (overviewRes.status === 'fulfilled' && overviewRes.value.data) {
          setOverviewData(overviewRes.value.data);
        }

        if (metroRes.status === 'fulfilled' && metroRes.value.data) {
          setMetroData(metroRes.value.data);
        }

        if (msRes.status === 'fulfilled' && msRes.value.data && msRes.value.data.platforms) {
          setMarketShareData(msRes.value.data.platforms);
        }

        if (osaTrendsRes.status === 'fulfilled' && osaTrendsRes.value.data) {
          setOsaTrendsData(osaTrendsRes.value.data);
        }

        if (msTrendsRes.status === 'fulfilled' && msTrendsRes.value.data) {
          setMsTrendsData(msTrendsRes.value.data);
        }

      } catch (error) {
        console.error("Error fetching Standalone OSA Overview data:", error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  const isLoading = parentLoading || dataLoading;

  const kpis = useMemo(() => {
    // 1. Stock Availability
    const osaCardData = overviewData ? {
      value: (overviewData.stockAvailability !== null && overviewData.stockAvailability !== undefined && overviewData.stockAvailability !== 0)
        ? `${Number(overviewData.stockAvailability).toFixed(2)}%`
        : "N/A",
      delta: (overviewData.stockAvailability && overviewData.prevStockAvailability)
        ? Number(overviewData.stockAvailability) - Number(overviewData.prevStockAvailability)
        : 0,
      trend: osaTrendsData?.timeSeries?.map(p => p.Osa || 0) || []
    } : null;

    // 2. Metro City Stock Availability
    const metroCardData = metroData ? {
      value: (metroData.isMetroCity === false || !metroData.stockAvailability) ? "N/A" : `${Number(metroData.stockAvailability).toFixed(2)}%`,
      delta: (metroData.isMetroCity === false || !metroData.stockAvailability || !metroData.prevStockAvailability) ? 0 : Number(metroData.stockAvailability) - Number(metroData.prevStockAvailability),
      isNotMetro: metroData.isMetroCity === false || !metroData.stockAvailability,
      trend: osaTrendsData?.timeSeries?.map(p => p.Osa || 0) || []
    } : null;

    // 3. Market Share % — Coming Soon
    const msCardData = {
      value: "Coming Soon",
      delta: 0,
      isComingSoon: true,
      trend: []
    };

    const cards_config = [
      { key: 'osa', title: "Stock Availability", sub: "MTD on-shelf coverage", data: osaCardData, icon: Layers, gradient: ['#6366f1', '#8b5cf6'] },
      { key: 'availability', title: "Metro City Stock Availability", sub: "MTD availability across metro cities", data: metroCardData, icon: MapPin, gradient: ['#8b5cf6', '#a855f7'], infoTooltip: "This metric reflects stock availability exclusively across Tier 1 metro cities, providing a focused view of inventory health in high-demand urban markets." },
      { key: 'marketShare', title: `${dbDisplayName} Market Share%`, sub: "Overall Market Share", data: msCardData, icon: PieChart, gradient: ['#f43f5e', '#ec4899'] }
    ];

    return cards_config.map((cfg) => {
      const data = cfg.data || { value: "—", delta: 0, isNotMetro: false, trend: [] };
      const delta = Number(data.delta || 0);

      // Format delta label firmly avoiding double arrows
      let deltaText = data.deltaLabel || "";
      const isNA = data.value === "N/A" || data.value === "—";
      if (!deltaText) {
        deltaText = (data.isNotMetro || isNA) ? "" : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%`;
      } else {
        const isUp = delta >= 0 || (typeof deltaText === 'string' && (deltaText.includes('+') || deltaText.includes('▲')));
        const cleanText = deltaText.replace(/^[▲▼+\-\s]*/, '').trim();
        deltaText = `${isUp ? '▲' : '▼'} ${cleanText}`;
      }

      const prevText = (data.isNotMetro || isNA) ? "" : "vs Previous Period";

      return {
        id: `osa-overview-${cfg.key}`,
        title: cfg.title,
        value: data.value,
        subtitle: data.isNotMetro ? `Selected location is not a metro city` : cfg.sub,
        delta: parseFloat(delta.toFixed(1)) || 0,
        deltaLabel: deltaText,
        icon: cfg.icon,
        gradient: cfg.gradient,
        prevText: prevText,
        isNotMetro: data.isNotMetro,
        trendSeries: data.trend || []
      };
    });
  }, [overviewData, metroData, marketShareData, dbDisplayName, osaTrendsData, msTrendsData]);

  return (
    <div className="w-full mb-5">
      <SnapshotOverview
        title="Market Coverage Analysis"
        icon={LayoutGrid}
        chip="Absolute Basis"
        loading={isLoading}
        headerRight={
          <span className="px-4 py-1.5 text-xs font-bold text-slate-500 bg-slate-50/50 rounded-xl border border-slate-100 uppercase tracking-tight">
            vs Previous Period
          </span>
        }
        kpis={kpis}
        variant="detailed"
      />
    </div>
  );
}

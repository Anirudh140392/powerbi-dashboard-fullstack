import React, { useState, useMemo } from "react";
import {
  Box,
  Card,
  Typography,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import TableChartIcon from "@mui/icons-material/TableChart";

export default function CategoryTable() {
  const categories = [
    {
      name: "Fresheners",
      all: {
        offtake: "₹3.15 Cr",
        offtake_change: "+2.3%",
        category_share: "35%",
        category_share_change: "+1.1%",
        category_size: "₹9.0 Cr",
        category_size_change: "+3.2%",
        wt_osa: "92.1%",
        wt_osa_change: "+0.8%",
        wt_disc: "6.8%",
        wt_disc_change: "-0.3%",
        overall_sov: "27.4%",
        overall_sov_change: "+2.2%",
        impressions: "4.2 Cr",
        impressions_change: "+4.1%",
        clicks: "6.4 L",
        clicks_change: "+3.5%",
        ctr: "1.52%",
        ctr_change: "-0.2%",
        cvr: "3.9%",
        cvr_change: "+0.5%",
        orders: "24.6K",
        orders_change: "+1.9%",
        ad_spends: "₹38.6L",
        ad_spends_change: "+4.2%",
        roas: "4.8x",
        roas_change: "-1.3%",
      },
      blinkit: {
        offtake: "₹1.05 Cr",
        offtake_change: "+3.1%",
        category_share: "33%",
        category_share_change: "+1.0%",
        category_size: "₹3.2 Cr",
        category_size_change: "+2.8%",
        wt_osa: "91.5%",
        wt_osa_change: "+0.7%",
        wt_disc: "6.2%",
        wt_disc_change: "-0.2%",
        overall_sov: "26.8%",
        overall_sov_change: "+1.9%",
        impressions: "1.4 Cr",
        impressions_change: "+3.8%",
        clicks: "2.2 L",
        clicks_change: "+3.0%",
        ctr: "1.57%",
        ctr_change: "-0.1%",
        cvr: "4.0%",
        cvr_change: "+0.6%",
        orders: "8.4K",
        orders_change: "+2.0%",
        ad_spends: "₹12.3L",
        ad_spends_change: "+3.9%",
        roas: "4.9x",
        roas_change: "-1.0%",
      },
      zepto: {
        offtake: "₹0.82 Cr",
        offtake_change: "+2.7%",
        category_share: "26%",
        category_share_change: "+0.9%",
        category_size: "₹2.5 Cr",
        category_size_change: "+3.0%",
        wt_osa: "92.0%",
        wt_osa_change: "+0.6%",
        wt_disc: "5.9%",
        wt_disc_change: "-0.3%",
        overall_sov: "25.3%",
        overall_sov_change: "+1.8%",
        impressions: "1.1 Cr",
        impressions_change: "+3.2%",
        clicks: "1.6 L",
        clicks_change: "+2.5%",
        ctr: "1.45%",
        ctr_change: "-0.2%",
        cvr: "3.8%",
        cvr_change: "+0.5%",
        orders: "6.3K",
        orders_change: "+1.6%",
        ad_spends: "₹9.8L",
        ad_spends_change: "+3.1%",
        roas: "4.7x",
        roas_change: "-0.9%",
      },
      swiggy: {
        offtake: "₹0.64 Cr",
        offtake_change: "+2.1%",
        category_share: "20%",
        category_share_change: "+0.8%",
        category_size: "₹2.0 Cr",
        category_size_change: "+2.9%",
        wt_osa: "90.8%",
        wt_osa_change: "+0.5%",
        wt_disc: "6.1%",
        wt_disc_change: "-0.3%",
        overall_sov: "23.5%",
        overall_sov_change: "+1.6%",
        impressions: "0.9 Cr",
        impressions_change: "+3.0%",
        clicks: "1.3 L",
        clicks_change: "+2.2%",
        ctr: "1.44%",
        ctr_change: "-0.1%",
        cvr: "3.7%",
        cvr_change: "+0.4%",
        orders: "5.1K",
        orders_change: "+1.5%",
        ad_spends: "₹8.2L",
        ad_spends_change: "+2.8%",
        roas: "4.6x",
        roas_change: "-0.7%",
      },
      amazon: {
        offtake: "₹0.35 Cr",
        offtake_change: "+3.4%",
        category_share: "10%",
        category_share_change: "+1.0%",
        category_size: "₹1.2 Cr",
        category_size_change: "+3.1%",
        wt_osa: "89.9%",
        wt_osa_change: "+0.5%",
        wt_disc: "6.3%",
        wt_disc_change: "-0.2%",
        overall_sov: "21.7%",
        overall_sov_change: "+1.5%",
        impressions: "0.6 Cr",
        impressions_change: "+2.9%",
        clicks: "0.8 L",
        clicks_change: "+2.1%",
        ctr: "1.33%",
        ctr_change: "-0.1%",
        cvr: "3.6%",
        cvr_change: "+0.4%",
        orders: "3.4K",
        orders_change: "+1.3%",
        ad_spends: "₹6.3L",
        ad_spends_change: "+2.4%",
        roas: "4.5x",
        roas_change: "-0.6%",
      },
      flipkart: {
        offtake: "₹0.29 Cr",
        offtake_change: "+1.9%",
        category_share: "8%",
        category_share_change: "+0.7%",
        category_size: "₹1.0 Cr",
        category_size_change: "+3.0%",
        wt_osa: "89.5%",
        wt_osa_change: "+0.4%",
        wt_disc: "6.4%",
        wt_disc_change: "-0.2%",
        overall_sov: "20.4%",
        overall_sov_change: "+1.2%",
        impressions: "0.5 Cr",
        impressions_change: "+2.8%",
        clicks: "0.6 L",
        clicks_change: "+2.0%",
        ctr: "1.30%",
        ctr_change: "-0.1%",
        cvr: "3.5%",
        cvr_change: "+0.4%",
        orders: "2.8K",
        orders_change: "+1.2%",
        ad_spends: "₹5.7L",
        ad_spends_change: "+2.1%",
        roas: "4.4x",
        roas_change: "-0.5%",
      },
    },
    {
      name: "Gel",
      all: {
        offtake: "₹2.25 Cr",
        offtake_change: "-1.5%",
        category_share: "25%",
        category_share_change: "-0.7%",
        category_size: "₹9.0 Cr",
        category_size_change: "+3.2%",
        wt_osa: "88.4%",
        wt_osa_change: "+0.4%",
        wt_disc: "5.2%",
        wt_disc_change: "+0.2%",
        overall_sov: "22.8%",
        overall_sov_change: "-1.5%",
        impressions: "3.1 Cr",
        impressions_change: "-2.1%",
        clicks: "4.8 L",
        clicks_change: "-1.4%",
        ctr: "1.55%",
        ctr_change: "+0.3%",
        cvr: "4.1%",
        cvr_change: "-0.6%",
        orders: "19.4K",
        orders_change: "-0.9%",
        ad_spends: "₹31.8L",
        ad_spends_change: "-1.1%",
        roas: "4.3x",
        roas_change: "-0.8%",
      },
      blinkit: {
        offtake: "₹0.75 Cr",
        offtake_change: "-0.9%",
        category_share: "30%",
        category_share_change: "-0.5%",
        category_size: "₹2.6 Cr",
        category_size_change: "+2.7%",
        wt_osa: "87.5%",
        wt_osa_change: "+0.3%",
        wt_disc: "5.4%",
        wt_disc_change: "+0.2%",
        overall_sov: "21.9%",
        overall_sov_change: "-1.3%",
        impressions: "1.0 Cr",
        impressions_change: "-1.7%",
        clicks: "1.6 L",
        clicks_change: "-1.0%",
        ctr: "1.60%",
        ctr_change: "+0.2%",
        cvr: "4.0%",
        cvr_change: "-0.5%",
        orders: "6.3K",
        orders_change: "-0.7%",
        ad_spends: "₹10.4L",
        ad_spends_change: "-0.8%",
        roas: "4.4x",
        roas_change: "-0.7%",
      },
      zepto: {
        offtake: "₹0.57 Cr",
        offtake_change: "-1.2%",
        category_share: "25%",
        category_share_change: "-0.6%",
        category_size: "₹2.2 Cr",
        category_size_change: "+2.8%",
        wt_osa: "88.0%",
        wt_osa_change: "+0.4%",
        wt_disc: "5.1%",
        wt_disc_change: "+0.1%",
        overall_sov: "22.1%",
        overall_sov_change: "-1.4%",
        impressions: "0.8 Cr",
        impressions_change: "-1.6%",
        clicks: "1.3 L",
        clicks_change: "-0.9%",
        ctr: "1.58%",
        ctr_change: "+0.2%",
        cvr: "4.1%",
        cvr_change: "-0.4%",
        orders: "5.0K",
        orders_change: "-0.8%",
        ad_spends: "₹8.9L",
        ad_spends_change: "-0.9%",
        roas: "4.3x",
        roas_change: "-0.6%",
      },
      swiggy: {
        offtake: "₹0.46 Cr",
        offtake_change: "-1.0%",
        category_share: "20%",
        category_share_change: "-0.4%",
        category_size: "₹1.8 Cr",
        category_size_change: "+2.9%",
        wt_osa: "87.8%",
        wt_osa_change: "+0.3%",
        wt_disc: "5.3%",
        wt_disc_change: "+0.1%",
        overall_sov: "22.4%",
        overall_sov_change: "-1.2%",
        impressions: "0.7 Cr",
        impressions_change: "-1.5%",
        clicks: "1.0 L",
        clicks_change: "-0.8%",
        ctr: "1.52%",
        ctr_change: "+0.2%",
        cvr: "4.0%",
        cvr_change: "-0.5%",
        orders: "4.1K",
        orders_change: "-0.6%",
        ad_spends: "₹7.8L",
        ad_spends_change: "-0.7%",
        roas: "4.2x",
        roas_change: "-0.5%",
      },
      amazon: {
        offtake: "₹0.27 Cr",
        offtake_change: "-0.6%",
        category_share: "12%",
        category_share_change: "-0.3%",
        category_size: "₹1.2 Cr",
        category_size_change: "+2.8%",
        wt_osa: "86.9%",
        wt_osa_change: "+0.3%",
        wt_disc: "5.2%",
        wt_disc_change: "+0.2%",
        overall_sov: "21.8%",
        overall_sov_change: "-1.0%",
        impressions: "0.5 Cr",
        impressions_change: "-1.3%",
        clicks: "0.7 L",
        clicks_change: "-0.7%",
        ctr: "1.40%",
        ctr_change: "+0.1%",
        cvr: "3.9%",
        cvr_change: "-0.4%",
        orders: "3.0K",
        orders_change: "-0.5%",
        ad_spends: "₹6.2L",
        ad_spends_change: "-0.6%",
        roas: "4.1x",
        roas_change: "-0.4%",
      },
      flipkart: {
        offtake: "₹0.20 Cr",
        offtake_change: "-0.8%",
        category_share: "8%",
        category_share_change: "-0.2%",
        category_size: "₹1.0 Cr",
        category_size_change: "+2.7%",
        wt_osa: "86.5%",
        wt_osa_change: "+0.2%",
        wt_disc: "5.3%",
        wt_disc_change: "+0.1%",
        overall_sov: "21.2%",
        overall_sov_change: "-0.9%",
        impressions: "0.4 Cr",
        impressions_change: "-1.2%",
        clicks: "0.6 L",
        clicks_change: "-0.6%",
        ctr: "1.35%",
        ctr_change: "+0.1%",
        cvr: "3.8%",
        cvr_change: "-0.3%",
        orders: "2.4K",
        orders_change: "-0.4%",
        ad_spends: "₹5.1L",
        ad_spends_change: "-0.5%",
        roas: "4.0x",
        roas_change: "-0.3%",
      },
    },
    {
      name: "Detergent",
      all: {
        offtake: "₹2.25 Cr",
        offtake_change: "+1.1%",
        category_share: "25%",
        category_share_change: "+0.5%",
        category_size: "₹9.0 Cr",
        category_size_change: "+3.2%",
        wt_osa: "89.6%",
        wt_osa_change: "+0.7%",
        wt_disc: "4.9%",
        wt_disc_change: "-0.4%",
        overall_sov: "25.6%",
        overall_sov_change: "+1.2%",
        impressions: "3.3 Cr",
        impressions_change: "+1.7%",
        clicks: "5.0 L",
        clicks_change: "+2.3%",
        ctr: "1.51%",
        ctr_change: "-0.1%",
        cvr: "3.8%",
        cvr_change: "+0.4%",
        orders: "20.1K",
        orders_change: "+1.5%",
        ad_spends: "₹33.4L",
        ad_spends_change: "+2.1%",
        roas: "4.6x",
        roas_change: "+0.9%",
      },
      blinkit: {
        offtake: "₹0.75 Cr",
        offtake_change: "+1.6%",
        category_share: "30%",
        category_share_change: "+0.8%",
        category_size: "₹2.5 Cr",
        category_size_change: "+2.9%",
        wt_osa: "89.0%",
        wt_osa_change: "+0.6%",
        wt_disc: "4.7%",
        wt_disc_change: "-0.3%",
        overall_sov: "24.9%",
        overall_sov_change: "+1.1%",
        impressions: "1.1 Cr",
        impressions_change: "+1.5%",
        clicks: "1.6 L",
        clicks_change: "+2.0%",
        ctr: "1.45%",
        ctr_change: "-0.1%",
        cvr: "3.8%",
        cvr_change: "+0.4%",
        orders: "6.4K",
        orders_change: "+1.3%",
        ad_spends: "₹10.2L",
        ad_spends_change: "+1.7%",
        roas: "4.6x",
        roas_change: "+0.8%",
      },
      zepto: {
        offtake: "₹0.57 Cr",
        offtake_change: "+0.8%",
        category_share: "25%",
        category_share_change: "+0.6%",
        category_size: "₹2.1 Cr",
        category_size_change: "+2.8%",
        wt_osa: "89.4%",
        wt_osa_change: "+0.5%",
        wt_disc: "4.8%",
        wt_disc_change: "-0.2%",
        overall_sov: "25.0%",
        overall_sov_change: "+1.0%",
        impressions: "0.9 Cr",
        impressions_change: "+1.4%",
        clicks: "1.3 L",
        clicks_change: "+1.8%",
        ctr: "1.44%",
        ctr_change: "-0.1%",
        cvr: "3.7%",
        cvr_change: "+0.3%",
        orders: "5.0K",
        orders_change: "+1.2%",
        ad_spends: "₹8.7L",
        ad_spends_change: "+1.5%",
        roas: "4.5x",
        roas_change: "+0.7%",
      },
      swiggy: {
        offtake: "₹0.52 Cr",
        offtake_change: "+0.9%",
        category_share: "22%",
        category_share_change: "+0.5%",
        category_size: "₹2.0 Cr",
        category_size_change: "+2.7%",
        wt_osa: "89.1%",
        wt_osa_change: "+0.5%",
        wt_disc: "4.9%",
        wt_disc_change: "-0.2%",
        overall_sov: "24.6%",
        overall_sov_change: "+0.9%",
        impressions: "0.8 Cr",
        impressions_change: "+1.3%",
        clicks: "1.1 L",
        clicks_change: "+1.7%",
        ctr: "1.43%",
        ctr_change: "-0.1%",
        cvr: "3.7%",
        cvr_change: "+0.3%",
        orders: "4.2K",
        orders_change: "+1.1%",
        ad_spends: "₹7.6L",
        ad_spends_change: "+1.4%",
        roas: "4.4x",
        roas_change: "+0.6%",
      },
      amazon: {
        offtake: "₹0.28 Cr",
        offtake_change: "+0.7%",
        category_share: "12%",
        category_share_change: "+0.4%",
        category_size: "₹1.2 Cr",
        category_size_change: "+2.6%",
        wt_osa: "88.5%",
        wt_osa_change: "+0.4%",
        wt_disc: "4.8%",
        wt_disc_change: "-0.2%",
        overall_sov: "23.9%",
        overall_sov_change: "+0.8%",
        impressions: "0.5 Cr",
        impressions_change: "+1.1%",
        clicks: "0.7 L",
        clicks_change: "+1.5%",
        ctr: "1.40%",
        ctr_change: "-0.1%",
        cvr: "3.6%",
        cvr_change: "+0.2%",
        orders: "2.8K",
        orders_change: "+1.0%",
        ad_spends: "₹6.1L",
        ad_spends_change: "+1.3%",
        roas: "4.3x",
        roas_change: "+0.5%",
      },
      flipkart: {
        offtake: "₹0.20 Cr",
        offtake_change: "+0.5%",
        category_share: "8%",
        category_share_change: "+0.3%",
        category_size: "₹1.0 Cr",
        category_size_change: "+2.6%",
        wt_osa: "88.2%",
        wt_osa_change: "+0.3%",
        wt_disc: "4.9%",
        wt_disc_change: "-0.2%",
        overall_sov: "23.4%",
        overall_sov_change: "+0.7%",
        impressions: "0.4 Cr",
        impressions_change: "+1.0%",
        clicks: "0.6 L",
        clicks_change: "+1.4%",
        ctr: "1.38%",
        ctr_change: "-0.1%",
        cvr: "3.5%",
        cvr_change: "+0.2%",
        orders: "2.1K",
        orders_change: "+0.9%",
        ad_spends: "₹5.2L",
        ad_spends_change: "+1.2%",
        roas: "4.2x",
        roas_change: "+0.4%",
      },
    },
    {
      name: "Soap",
      all: {
        offtake: "₹1.35 Cr",
        offtake_change: "-0.8%",
        category_share: "15%",
        category_share_change: "-0.5%",
        category_size: "₹9.0 Cr",
        category_size_change: "+2.7%",
        wt_osa: "88.7%",
        wt_osa_change: "-0.4%",
        wt_disc: "5.2%",
        wt_disc_change: "+0.3%",
        overall_sov: "18.3%",
        overall_sov_change: "-0.6%",
        impressions: "2.2 Cr",
        impressions_change: "-1.1%",
        clicks: "3.1 L",
        clicks_change: "-1.4%",
        ctr: "1.41%",
        ctr_change: "-0.2%",
        cvr: "3.4%",
        cvr_change: "-0.3%",
        orders: "10.5K",
        orders_change: "-1.0%",
        ad_spends: "₹22.6L",
        ad_spends_change: "-0.8%",
        roas: "4.1x",
        roas_change: "-0.5%",
      },
      blinkit: {
        offtake: "₹0.47 Cr",
        offtake_change: "-0.6%",
        category_share: "35%",
        category_share_change: "-0.4%",
        category_size: "₹1.9 Cr",
        category_size_change: "+2.4%",
        wt_osa: "88.5%",
        wt_osa_change: "-0.3%",
        wt_disc: "5.3%",
        wt_disc_change: "+0.3%",
        overall_sov: "18.1%",
        overall_sov_change: "-0.5%",
        impressions: "0.7 Cr",
        impressions_change: "-1.0%",
        clicks: "1.0 L",
        clicks_change: "-1.3%",
        ctr: "1.42%",
        ctr_change: "-0.2%",
        cvr: "3.5%",
        cvr_change: "-0.2%",
        orders: "3.7K",
        orders_change: "-0.9%",
        ad_spends: "₹7.5L",
        ad_spends_change: "-0.7%",
        roas: "4.2x",
        roas_change: "-0.4%",
      },
      zepto: {
        offtake: "₹0.34 Cr",
        offtake_change: "-0.7%",
        category_share: "25%",
        category_share_change: "-0.5%",
        category_size: "₹1.5 Cr",
        category_size_change: "+2.3%",
        wt_osa: "88.6%",
        wt_osa_change: "-0.3%",
        wt_disc: "5.2%",
        wt_disc_change: "+0.2%",
        overall_sov: "18.2%",
        overall_sov_change: "-0.5%",
        impressions: "0.5 Cr",
        impressions_change: "-1.1%",
        clicks: "0.7 L",
        clicks_change: "-1.4%",
        ctr: "1.41%",
        ctr_change: "-0.2%",
        cvr: "3.4%",
        cvr_change: "-0.3%",
        orders: "2.9K",
        orders_change: "-1.0%",
        ad_spends: "₹6.2L",
        ad_spends_change: "-0.8%",
        roas: "4.1x",
        roas_change: "-0.5%",
      },
      swiggy: {
        offtake: "₹0.27 Cr",
        offtake_change: "-0.8%",
        category_share: "20%",
        category_share_change: "-0.6%",
        category_size: "₹1.3 Cr",
        category_size_change: "+2.3%",
        wt_osa: "88.4%",
        wt_osa_change: "-0.3%",
        wt_disc: "5.2%",
        wt_disc_change: "+0.2%",
        overall_sov: "18.3%",
        overall_sov_change: "-0.5%",
        impressions: "0.4 Cr",
        impressions_change: "-1.1%",
        clicks: "0.6 L",
        clicks_change: "-1.4%",
        ctr: "1.40%",
        ctr_change: "-0.2%",
        cvr: "3.3%",
        cvr_change: "-0.3%",
        orders: "2.3K",
        orders_change: "-1.0%",
        ad_spends: "₹5.3L",
        ad_spends_change: "-0.8%",
        roas: "4.0x",
        roas_change: "-0.5%",
      },
      amazon: {
        offtake: "₹0.16 Cr",
        offtake_change: "-0.9%",
        category_share: "12%",
        category_share_change: "-0.6%",
        category_size: "₹1.1 Cr",
        category_size_change: "+2.2%",
        wt_osa: "88.2%",
        wt_osa_change: "-0.4%",
        wt_disc: "5.1%",
        wt_disc_change: "+0.2%",
        overall_sov: "18.4%",
        overall_sov_change: "-0.5%",
        impressions: "0.3 Cr",
        impressions_change: "-1.1%",
        clicks: "0.4 L",
        clicks_change: "-1.3%",
        ctr: "1.39%",
        ctr_change: "-0.2%",
        cvr: "3.3%",
        cvr_change: "-0.3%",
        orders: "1.6K",
        orders_change: "-1.0%",
        ad_spends: "₹4.5L",
        ad_spends_change: "-0.8%",
        roas: "4.0x",
        roas_change: "-0.5%",
      },
      flipkart: {
        offtake: "₹0.11 Cr",
        offtake_change: "-1.0%",
        category_share: "8%",
        category_share_change: "-0.6%",
        category_size: "₹1.0 Cr",
        category_size_change: "+2.2%",
        wt_osa: "88.1%",
        wt_osa_change: "-0.4%",
        wt_disc: "5.0%",
        wt_disc_change: "+0.2%",
        overall_sov: "18.5%",
        overall_sov_change: "-0.5%",
        impressions: "0.2 Cr",
        impressions_change: "-1.1%",
        clicks: "0.3 L",
        clicks_change: "-1.3%",
        ctr: "1.38%",
        ctr_change: "-0.2%",
        cvr: "3.2%",
        cvr_change: "-0.3%",
        orders: "1.1K",
        orders_change: "-1.0%",
        ad_spends: "₹3.9L",
        ad_spends_change: "-0.8%",
        roas: "3.9x",
        roas_change: "-0.5%",
      },
    },
  ];

  const platforms = Object.keys(categories[0]).filter((k) => k !== "name");

  const allMetricKeys = useMemo(() => {
    const set = new Set();
    categories.forEach((cat) => {
      platforms.forEach((p) => {
        Object.keys(cat[p] || {})
          .filter((k) => !k.endsWith("_change"))
          .forEach((k) => set.add(k));
      });
    });
    return Array.from(set);
  }, []);

  const metricOptions = allMetricKeys.map((key) => ({
    label: key.replace(/_/g, " ").toUpperCase(),
    key,
  }));

  const [selectedMetric, setSelectedMetric] = useState(metricOptions[0]);

  const renderChange = (value) => {
    if (!value) return "-";
    const positive = value.startsWith("+");
    return (
      <span style={{ color: positive ? "#16a34a" : "#dc2626" }}>
        {value}
      </span>
    );
  };

  return (
    <Box>
      <Card sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
        
        {/* HEADER */}
        <Box display="flex" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TableChartIcon sx={{ color: "#2563eb" }} />
            </Box>
            <Typography fontSize="1.25rem" fontWeight={700}>
              Split by Category
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Typography fontWeight={600} color="gray">
              Metrics:
            </Typography>

            <Select
              value={selectedMetric.key}
              onChange={(e) =>
                setSelectedMetric(
                  metricOptions.find((m) => m.key === e.target.value)
                )
              }
              sx={{
                minWidth: 200,
                background: "#f9fafb",
                borderRadius: "50px",
                px: 2,
                py: 1,
                "& fieldset": { border: "none" },
              }}
            >
              {metricOptions.map((opt) => (
                <MenuItem key={opt.key} value={opt.key}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Box>

        {/* TABLE */}
        <TableContainer component={Paper}>
          <Table stickyHeader>
            <TableHead>
              
              {/* ROW 1 */}
              <TableRow>
                <TableCell
                  sx={{
                    background: "#f9fafb",
                    fontWeight: 700,
                    position: "sticky",
                    left: 0,
                    zIndex: 10,
                  }}
                >
                  Category
                </TableCell>

                {platforms.map((p) => (
                  <TableCell
                    align="center"
                    key={p}
                    sx={{ background: "#f9fafb", fontWeight: 700 }}
                  >
                    {p.toUpperCase()}
                  </TableCell>
                ))}
              </TableRow>

              {/* ROW 2 — SINGLE CENTERED LABEL */}
              <TableRow>
                <TableCell
                  sx={{
                    background: "#f9fafb",
                    position: "sticky",
                    left: 0,
                    zIndex: 9,
                  }}
                ></TableCell>

                <TableCell
                  align="center"
                  colSpan={platforms.length}
                  sx={{
                    background: "#f9fafb",
                    color: "balck",
                    fontWeight: 900,
                    fontSize: "0.9rem",
                  }}
                >
                  {selectedMetric.label}
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {categories.map((cat, i) => (
                <TableRow key={i} hover>
                  <TableCell
                    sx={{
                      position: "sticky",
                      left: 0,
                      background: "white",
                      fontWeight: 700,
                    }}
                  >
                    {cat.name}
                  </TableCell>

                  {platforms.map((p) => {
                    const main = cat[p][selectedMetric.key];
                    const change = cat[p][selectedMetric.key + "_change"];
                    return (
                      <TableCell key={p + i} align="center">
                        <Box display="flex" flexDirection="column" alignItems="center">
                          <Typography fontWeight={600}>{main}</Typography>
                          <Typography fontSize="0.75rem">
                            {renderChange(change)}
                          </Typography>
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>

          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

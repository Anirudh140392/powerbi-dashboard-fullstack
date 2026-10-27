import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "KPI Definitions & Logic"

# Enable grid lines
ws.views.sheetView[0].showGridLines = True

headers = ["KPI", "Category", "Table", "Columns", "Excel / SQL Formula", "Description & Business Logic"]

kpi_data = [
    [
        "Offtake",
        "Sales Metrics",
        "rb_pdp_olap",
        "Sales, Qty_Sold, Selling_Price",
        "SUM(rb_pdp_olap.Sales)\nOR SUM(Qty_Sold * Selling_Price)",
        "Total sales revenue (gross/net offtake) generated from all product sales transactions across platforms during the selected timeframe."
    ],
    [
        "MRP",
        "Pricing Metrics",
        "rb_pdp_olap / products",
        "MRP",
        "MAX(MRP) OR AVG(MRP)",
        "Maximum Retail Price set by the manufacturer printed on the product packaging before any discounts or retailer markdowns."
    ],
    [
        "Discount",
        "Pricing & Promo",
        "rb_pdp_olap",
        "MRP, Selling_Price, Comp_flag",
        "Discount Amount = SUM(MRP - Selling_Price)\nDiscount % = AVG((MRP - Selling_Price) / MRP) * 100",
        "Value or percentage reduction offered off the MRP. Discount % measures depth of promotion for own products (Comp_flag=0) vs competitor products (Comp_flag=1)."
    ],
    [
        "ASP",
        "Sales & Pricing",
        "rb_pdp_olap",
        "Sales, Qty_Sold (or Ad_Orders)",
        "ASP = SUM(Sales) / SUM(Qty_Sold)\nOR SUM(Sales) / SUM(Orders)",
        "Average Selling Price (ASP) - The average price per unit at which products were actualized/sold after applying discounts."
    ],
    [
        "SOS",
        "Search & Visibility",
        "rb_kw_olap",
        "brand_name, kw_crawl_date, spons_flag, platform_name",
        "SOS % = (COUNT(Brand Keywords) / COUNT(Total Category Keywords)) * 100",
        "Share of Search (SOS) - The percentage of search result placements (organic + sponsored) captured by your brand relative to all competing brands on a platform."
    ],
    [
        "Spends",
        "Advertising",
        "rb_pdp_olap",
        "Ad_Spend",
        "SUM(rb_pdp_olap.Ad_Spend)",
        "Total monetary spend allocated to paid advertising campaigns (sponsored listings, banner ads, product ads) across platforms."
    ],
    [
        "Conversion",
        "Ad & Traffic Perf",
        "rb_pdp_olap",
        "Ad_Orders, Ad_Clicks",
        "Conversion % = (SUM(Ad_Orders) / SUM(Ad_Clicks)) * 100",
        "Conversion Rate - Percentage of users who clicked on an ad/listing and subsequently completed a purchase order."
    ],
    [
        "Inorganic sales",
        "Advertising & Sales",
        "rb_pdp_olap",
        "Ad_sales, Sales",
        "Inorganic Sales (₹) = SUM(Ad_sales)\nInorganic Sales % = (SUM(Ad_sales) / SUM(Sales)) * 100",
        "Paid / Ad-driven Sales revenue directly attributed to advertising campaigns. Inorganic Sales % shows the brand's dependency on paid media for total sales."
    ],
    [
        "ROAS",
        "Ad Efficiency",
        "rb_pdp_olap",
        "Ad_sales, Ad_Spend",
        "ROAS = SUM(Ad_sales) / SUM(Ad_Spend)",
        "Return on Ad Spend - Measures advertising revenue return per unit of currency spent. Example: ROAS of 4.0x means ₹4 ad sales per ₹1 ad spend."
    ],
    [
        "Orders",
        "Volume Metrics",
        "rb_pdp_olap",
        "Ad_Orders (or Order_ID count)",
        "Total Orders = SUM(Ad_Orders)\nOR COUNT(DISTINCT Order_ID)",
        "Total count of successful consumer purchase orders placed during the evaluated period."
    ]
]

# Styling definitions
header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid") # Dark slate
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

thin_border = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

# Write Title
ws.merge_cells("A1:F1")
title_cell = ws["A1"]
title_cell.value = "KPI Logic & Database Mapping Table"
title_cell.font = Font(name="Calibri", size=16, bold=True, color="0F172A")
title_cell.alignment = Alignment(vertical="center")
ws.row_dimensions[1].height = 35

# Write Subtitle
ws.merge_cells("A2:F2")
sub_cell = ws["A2"]
sub_cell.value = "Comprehensive reference for e-Commerce KPIs, database tables, column mappings, formulas, and business logic definitions."
sub_cell.font = Font(name="Calibri", size=10, italic=True, color="475569")
sub_cell.alignment = Alignment(vertical="center")
ws.row_dimensions[2].height = 20

# Header Row (Row 4)
ws.row_dimensions[4].height = 28
for col_num, header in enumerate(headers, 1):
    cell = ws.cell(row=4, column=col_num, value=header)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell.border = thin_border

# Data Rows (Row 5 onwards)
for row_idx, data_row in enumerate(kpi_data, 5):
    ws.row_dimensions[row_idx].height = 45
    is_even = (row_idx % 2 == 0)
    current_fill = zebra_fill if is_even else white_fill
    
    for col_idx, value in enumerate(data_row, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=value)
        cell.fill = current_fill
        cell.border = thin_border
        cell.font = Font(name="Calibri", size=10, color="0F172A")
        
        if col_idx in [1, 2, 3]:
            cell.alignment = Alignment(horizontal="center", vertical="center")
            if col_idx == 1:
                cell.font = Font(name="Calibri", size=10, bold=True, color="0F172A")
        elif col_idx in [4, 5]:
            cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
            cell.font = Font(name="Consolas", size=9.5, color="1E293B")
        else:
            cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

# Set specific column widths
col_widths = {
    1: 18,  # KPI
    2: 18,  # Category
    3: 20,  # Table
    4: 30,  # Columns
    5: 42,  # Formula
    6: 55   # Description
}

for col_idx, width in col_widths.items():
    col_letter = get_column_letter(col_idx)
    ws.column_dimensions[col_letter].width = width

wb.save("KPI_Logic_Mapping.xlsx")
print("Excel file created successfully: KPI_Logic_Mapping.xlsx")

from typing import Dict, Any, Optional
from .business_overview import BusinessOverviewModule
from .pricing import PricingModule
from .cross_platform_pricing import CrossPlatformPricingModule
from .availability_analysis import AvailabilityAnalysisModule
from .visibility_analysis import VisibilityAnalysisModule
from .content_analysis import ContentAnalysisModule
from .content_score import ContentScoreModule
from .pds_score import PdsScoreModule
from .market_share import MarketShareModule
from .performance_marketing import PerformanceMarketingModule
from .review_rating import ReviewRatingModule
from .primary_summary import PrimarySummaryModule
from .secondary_summary import SecondarySummaryModule
from .geo_intelligence import GeoIntelligenceModule
from .insights import InsightsModule

MODULES: Dict[str, Any] = {
    "business_overview": BusinessOverviewModule,
    "pricing": PricingModule,
    "cross_platform_pricing": CrossPlatformPricingModule,
    "availability_analysis": AvailabilityAnalysisModule,
    "visibility_analysis": VisibilityAnalysisModule,
    "content_score": ContentScoreModule,
    "content_analysis": ContentAnalysisModule,
    "pds_score": PdsScoreModule,
    "market_share": MarketShareModule,
    "performance_marketing": PerformanceMarketingModule,
    "review_rating": ReviewRatingModule,
    "primary_summary": PrimarySummaryModule,
    "secondary_summary": SecondarySummaryModule,
    "geo_intelligence": GeoIntelligenceModule,
    "insights": InsightsModule,
}


def get_module(name: str) -> Optional[Any]:
    return MODULES.get(name.lower())

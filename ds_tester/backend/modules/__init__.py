from typing import Dict, Any, Optional
from .business_overview import BusinessOverviewModule
from .pricing import PricingModule
from .cross_platform_pricing import CrossPlatformPricingModule
from .availability_analysis import AvailabilityAnalysisModule
from .visibility_analysis import VisibilityAnalysisModule
from .content_analysis import ContentAnalysisModule
from .content_score import ContentScoreModule
from .pds_score import PdsScoreModule

MODULES: Dict[str, Any] = {
    "business_overview": BusinessOverviewModule,
    "pricing": PricingModule,
    "cross_platform_pricing": CrossPlatformPricingModule,
    "availability_analysis": AvailabilityAnalysisModule,
    "visibility_analysis": VisibilityAnalysisModule,
    "content_score": ContentScoreModule,
    "content_analysis": ContentAnalysisModule,
    "pds_score": PdsScoreModule,
}


def get_module(name: str) -> Optional[Any]:
    return MODULES.get(name.lower())

import RbPdpOlap from "../models/RbPdpOlap.js";
import ServiceResponse from "../helper/ServiceResponse.js";

export const getDashboardData = async (req, res) => {
  try {
    const records = await RbPdpOlap.findAll({
      order: [["DATE", "DESC"]],
    });

    // Send back response
    return res
      .status(200)
      .json(
        ServiceResponse.success(
          "✅ Dashboard data fetched successfully",
          records
        )
      );
  } catch (error) {
    console.error("❌ Error fetching dashboard data:", error);
    return res
      .status(500)
      .json(
        ServiceResponse.error(
          "❌ Failed to fetch dashboard data",
          error.message
        )
      );
  }
};

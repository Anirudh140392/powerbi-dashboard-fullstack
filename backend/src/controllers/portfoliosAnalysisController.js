export const QualityProducts = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Quality products api request received", filters);

        const response = {
            message: "Portfolios Analysis API called successfully",
            filters: filters
        };
        console.log("Sending response:", response);

        // Mock response for now
        res.json(response);
    } catch (error) {
        console.error('Error in Portfolios Analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

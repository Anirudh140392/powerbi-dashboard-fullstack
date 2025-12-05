export const Platform = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Platform api request received", filters);

        const response = {
            message: "Market Share API called successfully",
            filters: filters
        };
        console.log("Sending response:", response);

        // Mock response for now
        res.json(response);
    } catch (error) {
        console.error('Error in Market Share:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

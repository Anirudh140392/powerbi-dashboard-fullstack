export const KpisOverview = async (req, res) => {
    try {
        const filters = req.query;
        console.log("kpis overview api request received", filters);

        const response = {
            message: "Performance Marketing API called successfully",
            filters: filters
        };
        console.log("Sending response:", response);

        // Mock response for now
        res.json(response);
    } catch (error) {
        console.error('Error in Performance Marketing:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

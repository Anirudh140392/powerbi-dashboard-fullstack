export const Categories = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Categories api request received", filters);

        const response = {
            message: "Category RCA API called successfully",
            filters: filters
        };
        console.log("Sending response:", response);

        // Mock response for now
        res.json(response);
    } catch (error) {
        console.error('Error in Category RCA:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

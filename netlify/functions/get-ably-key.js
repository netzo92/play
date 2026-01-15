exports.handler = async (event, context) => {
    const key = process.env.ABLY_API_KEY;

    if (!key) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'ABLY_API_KEY not found in environment' }),
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ key }),
    };
};

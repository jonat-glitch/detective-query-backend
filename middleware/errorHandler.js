function errorHandler(err, req, res, next) {
    console.error("GLOBAL ERROR:", err);

    const statusCode = err.status || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        status: statusCode
    });
}

module.exports = errorHandler;
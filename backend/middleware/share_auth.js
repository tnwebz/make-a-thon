const jwt = require('jsonwebtoken');
const { ShareSession } = require('../models');

const SECRET_KEY = process.env.SECRET_KEY || "supersecretkey_change_this_in_production";

/**
 * Middleware to validate share access tokens.
 * These are separate from normal user auth tokens.
 * Share tokens contain: { shareCode, courseId, accessMode }
 */
const shareAuthMiddleware = async (req, res, next) => {
    try {
        // Accept token from Authorization header or query param (for downloads)
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ detail: "Share access token required" });
        }

        const payload = jwt.verify(token, SECRET_KEY);

        if (payload.type !== 'share_access') {
            return res.status(401).json({ detail: "Invalid token type" });
        }

        // Verify the share session still exists and is active
        const session = await ShareSession.findOne({
            where: {
                shareCode: payload.shareCode,
                status: 'ACTIVE'
            }
        });

        if (!session) {
            return res.status(403).json({ detail: "Share session has been revoked or expired" });
        }

        // Check expiry
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
            return res.status(403).json({ detail: "Share session has expired" });
        }

        // Verify the shareCode in URL matches the token
        if (req.params.shareCode && req.params.shareCode !== payload.shareCode) {
            return res.status(403).json({ detail: "Token does not match this share session" });
        }

        // Attach share context to request
        req.share = {
            shareCode: payload.shareCode,
            courseId: payload.courseId,
            accessMode: payload.accessMode,
            session: session
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ detail: "Share access token has expired" });
        }
        return res.status(401).json({ detail: "Invalid share access token" });
    }
};

module.exports = { shareAuthMiddleware };

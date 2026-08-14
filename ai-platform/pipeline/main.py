"""Minimal FastAPI application for the ai-platform pipeline service.

Provides a health endpoint for container orchestration and a Stripe webhook
receiver for billing pipeline verification.
"""
import os
from fastapi import FastAPI, Request, HTTPException

app = FastAPI(title="SimpleBeacon Pipeline", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "simplebeacon-pipeline"}


@app.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Receive Stripe webhook events for billing pipeline verification."""
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty body")
    return {"received": True}

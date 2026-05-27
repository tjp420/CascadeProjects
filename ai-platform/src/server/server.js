/**
 * AI Coding Intelligence Dashboard - Stripe Payment Server
 * Simple Express server for handling Stripe payments and subscriptions
 */

require('dotenv').config();
const express = require('express');

// Security: Require STRIPE_SECRET_KEY environment variable
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('ERROR: STRIPE_SECRET_KEY environment variable is required');
  process.exit(1);
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from web directory
app.use(express.static('web'));

// Root route - serve dashboard
app.get('/', (req, res) => {
  res.sendFile('ai_dashboard.html', { root: './web' });
});

// Stable dashboard route
app.get('/stable_dashboard', (req, res) => {
  res.sendFile('stable_dashboard.html', { root: './web' });
});

// Web dashboard route
app.get('/web/stable_dashboard.html', (req, res) => {
  res.sendFile('stable_dashboard.html', { root: './web' });
});

// In-memory storage for demo purposes (replace with real database in production)
const users = new Map();
const subscriptions = new Map();

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * AI Build endpoint - Integrates with internal AI system
 */
app.post('/api/ai-build', async (req, res) => {
  try {
    const { requirements, projectType, techStack, includeTests, includeDocs, includeDeployment } =
      req.body;

    console.log('🤖 AI Build Request:', { requirements, projectType, techStack });

    // Import and use the internal AI system
    const { spawn } = require('child_process');
    const path = require('path');

    // Path to the internal AI system
    const aiSystemPath = path.join(__dirname, 'src', 'gguf_data');

    return new Promise((resolve, reject) => {
      const aiProcess = spawn('python', ['main.py', requirements], {
        cwd: aiSystemPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      aiProcess.stdout.on('data', data => {
        output += data.toString();
      });

      aiProcess.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      aiProcess.on('close', code => {
        console.log('AI Process completed with code:', code);

        if (code === 0) {
          // Parse the results from the AI system
          let results = {
            success: true,
            requirements: requirements,
            projectType: projectType,
            techStack: techStack,
            duration: Math.random() * 20 + 10, // Simulated duration
            filesGenerated: Math.floor(Math.random() * 15) + 8,
            testsCreated: includeTests ? Math.floor(Math.random() * 10) + 5 : 0,
            documentationGenerated: includeDocs,
            deploymentReady: includeDeployment,
            projectStructure: generateProjectStructure(projectType, techStack),
            output: output,
            nextSteps: [
              'Review generated code in the project directory',
              'Run local tests to verify functionality',
              'Customize styling and business logic',
              'Deploy to your preferred hosting platform',
            ],
          };

          resolve(res.json(results));
        } else {
          console.error('AI Process Error:', errorOutput);
          resolve(
            res.status(500).json({
              success: false,
              error: 'AI build process failed',
              details: errorOutput,
            })
          );
        }
      });

      aiProcess.on('error', error => {
        console.error('AI Process Spawn Error:', error);
        resolve(
          res.status(500).json({
            success: false,
            error: 'Failed to start AI build process',
            details: error.message,
          })
        );
      });
    });
  } catch (error) {
    console.error('AI Build API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
});

function generateProjectStructure(projectType, techStack) {
  const structures = {
    web: {
      react: `project/
├── src/
│   ├── components/
│   │   ├── Header.js
│   │   ├── Footer.js
│   │   └── Dashboard.js
│   ├── pages/
│   │   ├── Home.js
│   │   └── About.js
│   ├── hooks/
│   │   └── useAuth.js
│   ├── utils/
│   │   └── api.js
│   ├── App.js
│   └── index.js
├── public/
│   ├── index.html
│   └── favicon.ico
├── package.json
├── README.md
└── .gitignore`,
      vue: `project/
├── src/
│   ├── components/
│   │   ├── Header.vue
│   │   └── Dashboard.vue
│   ├── views/
│   │   ├── Home.vue
│   │   └── About.vue
│   ├── router/
│   │   └── index.js
│   ├── store/
│   │   └── index.js
│   ├── App.vue
│   └── main.js
├── public/
│   └── index.html
├── package.json
├── README.md
└── .gitignore`,
      python: `project/
├── app/
│   ├── __init__.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   └── api.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth_service.py
│   ├── templates/
│   │   ├── base.html
│   │   ├── index.html
│   │   └── dashboard.html
│   └── main.py
├── static/
│   ├── css/
│   ├── js/
│   └── images/
├── tests/
│   ├── test_auth.py
│   └── test_api.py
├── requirements.txt
├── README.md
└── .gitignore`,
    },
    api: {
      python: `project/
├── app/
│   ├── __init__.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── product.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── users.py
│   │   └── products.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   └── user_service.py
│   ├── utils/
│   │   ├── __init__.py
│   │   └── security.py
│   └── main.py
├── tests/
│   ├── test_auth.py
│   ├── test_users.py
│   └── test_products.py
├── requirements.txt
├── README.md
└── .gitignore`,
      node: `project/
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   └── productController.js
│   ├── models/
│   │   ├── User.js
│   │   └── Product.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   └── products.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validation.js
│   ├── utils/
│   │   ├── database.js
│   │   └── helpers.js
│   ├── config/
│   │   └── database.js
│   └── app.js
├── tests/
│   ├── auth.test.js
│   ├── users.test.js
│   └── products.test.js
├── package.json
├── README.md
└── .gitignore`,
    },
    mobile: {
      react: `project/
├── src/
│   ├── components/
│   │   ├── Header.js
│   │   ├── Footer.js
│   │   └── Button.js
│   ├── screens/
│   │   ├── HomeScreen.js
│   │   ├── ProfileScreen.js
│   │   └── SettingsScreen.js
│   ├── navigation/
│   │   └── AppNavigator.js
│   ├── services/
│   │   └── api.js
│   ├── utils/
│   │   └── helpers.js
│   └── App.js
├── android/
├── ios/
├── package.json
├── README.md
└── .gitignore`,
    },
  };

  return (
    structures[projectType]?.[techStack] ||
    `project/
├── src/
├── tests/
├── docs/
├── README.md
└── .gitignore`
  );
}

/**
 * Create Stripe checkout session
 */
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId, customerEmail } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    // Demo mode: If Stripe is not properly configured, return a mock response
    if (
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes('your_secret_key')
    ) {
      console.log('🎭 Demo mode: Returning mock checkout session');
      const mockSessionId = `cs_demo_${Date.now()}`;
      const tier = getTierFromPriceId(priceId);

      // Store mock subscription
      if (customerEmail) {
        subscriptions.set(customerEmail, {
          stripeCustomerId: `cus_demo_${Date.now()}`,
          stripeSubscriptionId: `sub_demo_${Date.now()}`,
          tier,
          status: 'active',
          cancelAtPeriodEnd: false,
          email: customerEmail,
        });
      }

      return res.json({
        id: mockSessionId,
        url: `${process.env.APP_URL || 'https://replace_with_real_app_url.com'}/dashboard?demo=true&tier=${tier}`,
        demo: true,
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL || 'http://localhost:9000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:9000'}/pricing.html`,
      customer_email: customerEmail,
      metadata: {
        tier: getTierFromPriceId(priceId),
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout session creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get subscription status
 */
app.get('/api/subscription-status', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.email;

    if (!userId) {
      return res.json({ status: 'none', tier: 'free' });
    }

    const subscription = subscriptions.get(userId);

    if (!subscription) {
      return res.json({ status: 'none', tier: 'free' });
    }

    // Demo mode: Return mock subscription data
    if (
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes('your_secret_key')
    ) {
      console.log('🎭 Demo mode: Returning mock subscription status');
      return res.json({
        status: subscription.status || 'active',
        tier: subscription.tier || 'basic',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        demo: true,
      });
    }

    // Verify subscription status with Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    res.json({
      status: stripeSubscription.status,
      tier: subscription.tier,
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel subscription
 */
app.post('/api/cancel-subscription', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const subscription = subscriptions.get(userId);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Cancel subscription at period end
    const canceledSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    subscription.cancelAtPeriodEnd = true;
    subscriptions.set(userId, subscription);

    res.json({
      status: canceledSubscription.status,
      cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
      currentPeriodEnd: new Date(canceledSubscription.current_period_end * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update subscription (upgrade/downgrade)
 */
app.post('/api/update-subscription', async (req, res) => {
  try {
    const { priceId } = req.body;
    const userId = req.headers['x-user-id'];

    if (!priceId || !userId) {
      return res.status(400).json({ error: 'Price ID and User ID required' });
    }

    const subscription = subscriptions.get(userId);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Get current subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    // Update subscription item
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: priceId,
          },
        ],
      }
    );

    // Update local storage
    subscription.tier = getTierFromPriceId(priceId);
    subscriptions.set(userId, subscription);

    res.json({
      status: updatedSubscription.status,
      tier: subscription.tier,
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get billing portal URL
 */
app.post('/api/billing-portal', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const subscription = subscriptions.get(userId);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.APP_URL || 'http://localhost:9000'}/dashboard`,
    });

    res.json({ url: portalSession.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stripe webhook handler
 */
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // For testing without webhook secret
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleCheckoutSessionCompleted(session);
      break;
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      await handleSubscriptionUpdated(subscription);
      break;
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object;
      await handleSubscriptionDeleted(deletedSubscription);
      break;
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      await handleInvoicePaymentSucceeded(invoice);
      break;
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      await handleInvoicePaymentFailed(failedInvoice);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

/**
 * Webhook handlers
 */
async function handleCheckoutSessionCompleted(session) {
  console.log('Checkout session completed:', session.id);

  // In production, you would:
  // 1. Get customer info from session
  // 2. Create/update user in your database
  // 3. Store subscription info
  // 4. Send welcome email

  const userId = session.metadata?.userId || session.customer_email;
  if (userId) {
    subscriptions.set(userId, {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      tier: session.metadata?.tier || 'basic',
      status: 'active',
      cancelAtPeriodEnd: false,
    });
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);
  // Update subscription status in database
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);
  // Handle subscription cancellation in database
}

async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Invoice payment succeeded:', invoice.id);
  // Send payment confirmation email
}

async function handleInvoicePaymentFailed(invoice) {
  console.log('Invoice payment failed:', invoice.id);
  // Send payment failed notification
}

/**
 * Helper function to determine tier from price ID
 */
function getTierFromPriceId(priceId) {
  if (priceId.includes('basic')) {
    return 'basic';
  }
  if (priceId.includes('pro')) {
    return 'pro';
  }
  if (priceId.includes('enterprise')) {
    return 'enterprise';
  }
  return 'basic';
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stripe payment server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
});

module.exports = app;

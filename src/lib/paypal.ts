const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

function paypalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable",
    );
  }
  return { clientId, clientSecret };
}

export async function getPayPalAccessToken() {
  const { clientId, clientSecret } = paypalCredentials();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = (await response.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    console.error("PayPal authentication failed:", data.error_description);
    throw new Error("Could not authenticate with PayPal");
  }
  return data.access_token;
}

export async function createPayPalOrder(
  accessToken: string,
  input: {
    paymentId: string;
    amount: number;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  },
) {
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.paymentId,
          custom_id: input.paymentId,
          description: input.description,
          amount: {
            currency_code: "GBP",
            value: input.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "Hirzo",
        user_action: "PAY_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
    cache: "no-store",
  });
  const data = (await response.json()) as {
    id?: string;
    links?: Array<{ rel: string; href: string }>;
    message?: string;
  };
  if (!response.ok || !data.id) {
    console.error("PayPal order creation failed:", data.message);
    throw new Error("Could not create a PayPal order");
  }
  const approvalUrl = data.links?.find((link) => link.rel === "approve")?.href;
  if (!approvalUrl) {
    throw new Error("PayPal did not provide an approval URL");
  }
  return { id: data.id, approvalUrl };
}

export async function capturePayPalOrder(
  accessToken: string,
  orderId: string,
) {
  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    },
  );
  const data = (await response.json()) as {
    status?: string;
    purchase_units?: Array<{
      custom_id?: string;
      payments?: {
        captures?: Array<{
          status?: string;
          amount?: { currency_code?: string; value?: string };
        }>;
      };
    }>;
    message?: string;
  };
  if (!response.ok) {
    console.error("PayPal capture failed:", data.message);
    throw new Error("Could not capture the PayPal payment");
  }
  return data;
}

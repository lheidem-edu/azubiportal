/**
 * Microsoft Teams erhält die Benachrichtigung über einen eingehenden Webhook
 * bzw. einen Power-Automate-Workflow. Beide akzeptieren eine Adaptive Card,
 * die in einen `attachments`-Umschlag verpackt wird.
 */

export type TeamsCard = {
  title: string;
  subtitle?: string;
  facts: { name: string; value: string }[];
  text?: string;
  linkUrl?: string;
  linkTitle?: string;
};

export function buildAdaptiveCard(card: TeamsCard) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: card.title, weight: "Bolder", size: "Medium", wrap: true },
            ...(card.subtitle
              ? [{ type: "TextBlock", text: card.subtitle, isSubtle: true, spacing: "None", wrap: true }]
              : []),
            ...(card.facts.length
              ? [{ type: "FactSet", facts: card.facts }]
              : []),
            ...(card.text ? [{ type: "TextBlock", text: card.text, wrap: true }] : []),
          ],
          actions: card.linkUrl
            ? [{ type: "Action.OpenUrl", title: card.linkTitle ?? "Plan öffnen", url: card.linkUrl }]
            : [],
        },
      },
    ],
  };
}

export async function sendTeamsCard(webhookUrl: string, card: TeamsCard) {
  if (!webhookUrl) {
    return { ok: false as const, error: "Kein Teams-Webhook hinterlegt." };
  }
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAdaptiveCard(card)),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false as const, error: `Teams antwortete mit ${response.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

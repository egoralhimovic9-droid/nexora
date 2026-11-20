
export async function onRequestPost({ request, env }) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });

  // Секретные настройки хранятся в Cloudflare
  const webhookUrl = env.MAKE_WEBHOOK_URL;
  const apiKey = env.MAKE_API_KEY;

  if (!webhookUrl || !apiKey) {
    return json({
      error: "Сервис анализа ещё не настроен."
    }, 503);
  }

  let data;

  try {
    data = await request.json();
  } catch {
    return json({
      error: "Неверный формат запроса."
    }, 400);
  }

  const idea = typeof data?.idea === "string"
    ? data.idea.trim()
    : "";

  const country = typeof data?.country === "string"
    ? data.country.trim()
    : "";

  const budget = data?.budget == null ||
    data.budget === ""
      ? null
      : Number(data.budget);

  if (
    !idea ||
    !country ||
    idea.length > 5000 ||
    country.length > 100 ||
    (budget !== null &&
      (!Number.isFinite(budget) || budget < 0))
  ) {
    return json({
      error: "Проверь описание идеи, страну и бюджет."
    }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    110000
  );

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-make-apikey": apiKey
      },
      body: JSON.stringify({
        idea,
        country,
        budget
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return json({
        error: "Не удалось выполнить анализ в Make."
      }, 502);
    }

    const analysis = await response.text();

    if (!analysis.trim()) {
      return json({
        error: "ИИ-агент вернул пустой ответ."
      }, 502);
    }

    return json({ analysis });

  } catch {
    return json({
      error: "Сервис анализа временно недоступен."
    }, 502);

  } finally {
    clearTimeout(timeout);
  }
}

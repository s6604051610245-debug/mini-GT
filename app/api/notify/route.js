// Route Handler ฝั่ง Server — Bot Token ไม่รั่วไปถึง browser
export async function POST(request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  // ถ้ายังไม่ได้ตั้งค่า env ก็ข้ามไป ไม่ต้องทำให้ระบบขายพัง
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return Response.json({ ok: false, reason: 'missing_config' }, { status: 200 });
  }

  try {
    const { messages } = await request.json();
    const list = Array.isArray(messages) ? messages : [];

    // ส่งทีละข้อความ (Order Alert + Low Stock Alert)
    for (const text of list) {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'HTML',
          }),
        }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Telegram notify error:', err);
    // คืน 200 เสมอ เพื่อไม่ให้ฝั่งหน้าเว็บมองว่าการขายล้มเหลว
    return Response.json({ ok: false, reason: 'send_failed' }, { status: 200 });
  }
}

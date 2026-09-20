'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// เกณฑ์เตือนภัยสต๊อกเหลือน้อย
const LOW_STOCK_THRESHOLD = 5;

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setErrorMsg('โหลดรายการสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  function resetForm() {
    setSelectedProductId('');
    setQuantity('');
  }

  // ===== [เพิ่มใหม่] สร้างข้อความและส่งแจ้งเตือน Telegram =====
  // หมายเหตุ: parse_mode = HTML จึงต้องใช้ <b> ไม่ใช่ ** แบบ Markdown
  async function sendTelegramNotify(product, qty, total, newStock) {
    const timeText = new Date().toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const messages = [];

    // งานที่ 1: แจ้งเตือน Order เข้า
    messages.push(
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
        `- สินค้า: ${product.name}\n` +
        `- จำนวน: ${qty} ${product.unit || 'ชิ้น'}\n` +
        `- ราคารวม: ${Number(total).toFixed(2)} บาท\n` +
        `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ${product.unit || 'ชิ้น'}\n` +
        `- เวลา: ${timeText}`
    );

    // งานที่ 2: แจ้งเตือนสต๊อกเหลือน้อย (ส่งแยกอีก 1 ข้อความ)
    if (newStock <= LOW_STOCK_THRESHOLD) {
      messages.push(
        `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
          `- สินค้า: ${product.name}\n` +
          `- คงเหลือเพียง: ${newStock} ${product.unit || 'ชิ้น'}\n` +
          `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
      );
    }

    // ยิงเข้า API Route ฝั่ง Server — ครอบ try/catch ไว้
    // ถ้าล้มเหลวก็แค่ log ไม่ทำให้การขายที่สำเร็จแล้วพัง
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
    } catch (err) {
      console.error('ส่งแจ้งเตือน Telegram ไม่สำเร็จ:', err);
    }
  }

  async function handleSell(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedProduct) {
      setErrorMsg('กรุณาเลือกสินค้า');
      return;
    }
    if (qtyNumber <= 0) {
      setErrorMsg('กรุณากรอกจำนวนที่ถูกต้อง');
      return;
    }
    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setSubmitting(true);

    // 1) บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from('sales').insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg('บันทึกการขายไม่สำเร็จ: ' + saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) ตัดสต๊อก
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProduct.id);

    if (updateError) {
      setErrorMsg(
        'บันทึกการขายสำเร็จ แต่ปรับปรุงจำนวนคงเหลือไม่สำเร็จ: ' +
          updateError.message
      );
      setSubmitting(false);
      return;
    }

    // 3) แจ้งเตือนสำเร็จบนหน้าเว็บก่อน (ไม่รอ Telegram)
    setSuccessMsg(
      `ขาย "${selectedProduct.name}" จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ (รวม ${totalPrice} บาท)`
    );

    // 4) [เพิ่มใหม่] ยิงแจ้งเตือน Telegram หลังตัดสต๊อกสำเร็จ
    //    ไม่ใช้ await ผูกกับ flow หลัก เพื่อไม่ให้หน่วงหรือทำให้การขายล้มเหลว
    sendTelegramNotify(selectedProduct, qtyNumber, totalPrice, newStock);

    resetForm();
    fetchProducts();
    setSubmitting(false);
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && <p className="error-text">{errorMsg}</p>}
      {successMsg && <p className="success-text">{successMsg}</p>}

      <div className="card">
        {loading ? (
          <p>กำลังโหลดรายการสินค้า...</p>
        ) : (
          <form onSubmit={handleSell}>
            <div className="form-row">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.price} บาท/{p.unit}) - คงเหลือ {p.stock}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="จำนวน"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />

              <button type="submit" disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'ขาย'}
              </button>
            </div>

            {selectedProduct && qtyNumber > 0 && (
              <p>
                ยอดรวม: <strong>{totalPrice.toFixed(2)} บาท</strong>{' '}
                ({selectedProduct.price} x {qtyNumber})
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

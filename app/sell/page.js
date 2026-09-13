'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  // รายการสินค้าทั้งหมด สำหรับใช้ใน dropdown
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ค่าที่เลือก/กรอกในฟอร์มขาย
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // โหลดรายการสินค้าเมื่อ component mount
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

  // หาข้อมูลสินค้าที่เลือกอยู่ในปัจจุบัน
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวม = ราคา x จำนวน
  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  function resetForm() {
    setSelectedProductId('');
    setQuantity('');
  }

  // เมื่อกดปุ่ม "ขาย"
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

    // ตรวจสอบ stock คงเหลือให้เพียงพอ
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

    // 2) อัปเดต stock ของสินค้าให้ลดลงตามจำนวนที่ขาย
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

    // สำเร็จ: แจ้งเตือนและรีเซ็ตฟอร์ม
    setSuccessMsg(
      `ขาย "${selectedProduct.name}" จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ (รวม ${totalPrice} บาท)`
    );
    resetForm();
    fetchProducts(); // โหลด stock ล่าสุดใหม่
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
              {/* Dropdown เลือกสินค้า แสดงชื่อและราคา */}
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

              {/* ช่องกรอกจำนวน */}
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

            {/* แสดงยอดรวมอัตโนมัติก่อนกดยืนยัน */}
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

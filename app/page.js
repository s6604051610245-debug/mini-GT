'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ProductsPage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    unit: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // แถวที่กำลังแก้ไขแบบ inline (เก็บ id ของสินค้าที่กำลังแก้)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // โหลดข้อมูลสินค้าเมื่อ component mount
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setErrorMsg('');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMsg('โหลดข้อมูลสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  // อัปเดตค่าฟอร์มเพิ่มสินค้าใหม่
  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // เพิ่มสินค้าใหม่ลงตาราง products
  async function handleAddProduct(e) {
    e.preventDefault();
    if (!form.sku || !form.name) {
      setErrorMsg('กรุณากรอก SKU และชื่อสินค้า');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const { error } = await supabase.from('products').insert([
      {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock, 10) || 0,
        unit: form.unit,
      },
    ]);

    if (error) {
      setErrorMsg('เพิ่มสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setForm({ sku: '', name: '', price: '', stock: '', unit: '' });
      fetchProducts();
    }
    setSubmitting(false);
  }

  // ลบสินค้า
  async function handleDelete(id) {
    const confirmDelete = window.confirm('ต้องการลบสินค้านี้ใช่หรือไม่?');
    if (!confirmDelete) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setErrorMsg('ลบสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      fetchProducts();
    }
  }

  // เริ่มแก้ไขแถว: คัดลอกค่าปัจจุบันมาไว้ใน editForm
  function startEdit(product) {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  }

  // บันทึกการแก้ไขสินค้า
  async function handleSaveEdit(id) {
    setErrorMsg('');
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price) || 0,
        stock: parseInt(editForm.stock, 10) || 0,
        unit: editForm.unit,
      })
      .eq('id', id);

    if (error) {
      setErrorMsg('บันทึกการแก้ไขไม่สำเร็จ: ' + error.message);
    } else {
      setEditingId(null);
      setEditForm({});
      fetchProducts();
    }
  }

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2>เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleAddProduct}>
          <div className="form-row">
            <input
              name="sku"
              placeholder="SKU"
              value={form.sku}
              onChange={handleFormChange}
            />
            <input
              name="name"
              placeholder="ชื่อสินค้า"
              value={form.name}
              onChange={handleFormChange}
            />
            <input
              name="price"
              type="number"
              step="0.01"
              placeholder="ราคา"
              value={form.price}
              onChange={handleFormChange}
            />
            <input
              name="stock"
              type="number"
              placeholder="คงเหลือ"
              value={form.stock}
              onChange={handleFormChange}
            />
            <input
              name="unit"
              placeholder="หน่วย เช่น ชิ้น, ขวด"
              value={form.unit}
              onChange={handleFormChange}
            />
            <button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
            </button>
          </div>
        </form>
      </div>

      {/* ตารางแสดงรายการสินค้า */}
      <div className="card">
        <h2>สินค้าทั้งหมด</h2>
        {loading ? (
          <p>กำลังโหลดข้อมูล...</p>
        ) : products.length === 0 ? (
          <p>ยังไม่มีสินค้า</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>ชื่อสินค้า</th>
                <th>ราคา</th>
                <th>คงเหลือ</th>
                <th>หน่วย</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const isEditing = editingId === product.id;
                return (
                  <tr key={product.id}>
                    {isEditing ? (
                      <>
                        <td>
                          <input
                            name="sku"
                            value={editForm.sku}
                            onChange={handleEditChange}
                          />
                        </td>
                        <td>
                          <input
                            name="name"
                            value={editForm.name}
                            onChange={handleEditChange}
                          />
                        </td>
                        <td>
                          <input
                            name="price"
                            type="number"
                            step="0.01"
                            value={editForm.price}
                            onChange={handleEditChange}
                          />
                        </td>
                        <td>
                          <input
                            name="stock"
                            type="number"
                            value={editForm.stock}
                            onChange={handleEditChange}
                          />
                        </td>
                        <td>
                          <input
                            name="unit"
                            value={editForm.unit}
                            onChange={handleEditChange}
                          />
                        </td>
                        <td>
                          <button onClick={() => handleSaveEdit(product.id)}>
                            บันทึก
                          </button>{' '}
                          <button onClick={cancelEdit}>ยกเลิก</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{product.sku}</td>
                        <td>{product.name}</td>
                        <td>{product.price}</td>
                        <td>{product.stock}</td>
                        <td>{product.unit}</td>
                        <td>
                          <button onClick={() => startEdit(product)}>
                            แก้ไข
                          </button>{' '}
                          <button onClick={() => handleDelete(product.id)}>
                            ลบ
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

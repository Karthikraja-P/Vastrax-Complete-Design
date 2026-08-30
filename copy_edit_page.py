import re

with open('src/app/products/add/page.tsx', 'r') as f:
    content = f.read()

# 1. Rename component
content = content.replace('export default function AddProductPage() {', 'export default function EditProductPage() {')

# 2. Add imports
content = content.replace('import { useRouter } from "next/navigation";', 'import { useRouter, useSearchParams } from "next/navigation";')

# 3. Add productId hook
hook_str = """
export default function EditProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const [initialLoading, setInitialLoading] = useState(true);
"""
content = content.replace('export default function EditProductPage() {\n  const router = useRouter();', hook_str)

# 4. Modify useEffect
old_use_effect = """
  useEffect(() => {
    categoriesApi.list().then((data) => {
      setCategories(data || []);
      if (data && data.length > 0) setCategoryId(String(data[0].id));
    });
  }, []);
"""

new_use_effect = """
  useEffect(() => {
    async function loadData() {
      setInitialLoading(true);
      try {
        const cats = await categoriesApi.list();
        setCategories(cats || []);
        
        if (productId) {
          const prod = await productsApi.getById(productId);
          if (prod) {
            setName(prod.name || prod.title || "");
            setDescription(prod.description || "");
            const selling = prod.price_selling !== undefined ? prod.price_selling : (prod.price !== undefined ? prod.price : "");
            const mrp = prod.price_mrp !== undefined ? prod.price_mrp : (prod.originalPrice !== undefined ? prod.originalPrice : "");
            setPrice(String(selling));
            setComparePrice(String(mrp));
            setOccasion(prod.occasion || "");
            setModelPath(prod.model_path || "");
            
            const targetCat = String(prod.category_id || prod.categoryId || "");
            const foundCat = cats.find((c: any) => 
              String(c.id) === targetCat || 
              c.slug === targetCat || 
              c.name.toLowerCase() === String(prod.category || "").toLowerCase()
            );
            if (foundCat) setCategoryId(String(foundCat.id));
            else if (cats.length > 0) setCategoryId(String(cats[0].id));

            setIsActive(prod.is_published !== false);
            setIsFeatured(Boolean(prod.is_featured));
            
            const imgs = prod.images && prod.images.length > 0 
              ? prod.images.map((i: any, idx: number) => ({
                  id: `existing-${idx}`,
                  preview: typeof i === 'string' ? i : i.s3_url,
                  file: new File([], "existing"),
                  isExisting: true
                }))
              : prod.image ? [{ id: 'existing-0', preview: prod.image, file: new File([], "existing"), isExisting: true }] : [];
            setImages(imgs);

            if (prod.variants && prod.variants.length > 0) {
              setSku(prod.variants[0].sku || "");
              setStock(String(prod.variants[0].stock_qty || "10"));
            } else {
              setSku(prod.sku || `VAST-${String(prod.id).slice(0, 6).toUpperCase()}`);
              setStock(String(prod.stock ?? prod.inventoryCount ?? "10"));
            }
          }
        } else if (cats.length > 0) {
          setCategoryId(String(cats[0].id));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    }
    loadData();
  }, [productId]);
"""
content = content.replace(old_use_effect.strip(), new_use_effect.strip())

# 5. Modify API call
content = content.replace('await productsApi.create(payload);', 'if (productId) await productsApi.update(productId, payload); else await productsApi.create(payload);')
content = content.replace('Product added successfully', 'Product saved successfully')

# 6. Add Suspense boundary
suspense_wrapper = """
import React, { useState, useRef, useEffect, Suspense } from "react";
"""
content = content.replace('import React, { useState, useRef, useEffect } from "react";', suspense_wrapper.strip())

main_return_start = content.find('return (\n    <div className="min-h-screen bg-background pb-20">')
if main_return_start != -1:
    content = content[:main_return_start] + """
  if (initialLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

""" + content[main_return_start:]

# 7. Add Suspense wrap to the export
export_def = """
export default function EditProductPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>}>
      <EditProductContent />
    </Suspense>
  );
}

function EditProductContent() {
"""
content = content.replace('export default function EditProductPage() {', export_def.strip())


with open('src/app/products/edit/page.tsx', 'w') as f:
    f.write(content)

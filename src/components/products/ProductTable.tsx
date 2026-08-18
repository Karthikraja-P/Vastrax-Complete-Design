"use client";

import { useState, useEffect } from "react";
import { MoreHorizontal, Edit, Trash, Video, Image as ImageIcon, Box, Shirt, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { VirtualTryOnModal } from "@/components/products/VirtualTryOnModal";
import { productsApi, ProductItem } from "@/lib/api";

export function ProductTable() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openActionId, setOpenActionId] = useState<string | number | null>(null);
  const [vtoProduct, setVtoProduct] = useState<{name: string, image: string} | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    const data = await productsApi.list();
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleDelete = async (id: string | number) => {
    await productsApi.delete(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    setOpenActionId(null);
  };

  const toggleActions = (id: string | number) => {
    setOpenActionId(openActionId === id ? null : id);
  };

  const openVto = (product: ProductItem) => {
    setVtoProduct({
      name: product.name || product.title || "Product",
      image: product.image || product.images?.[0] || ""
    });
    setOpenActionId(null);
  };

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden mt-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-surface-hover/50 border-b border-border">
            <tr>
              <th className="px-6 py-4 font-medium">Product</th>
              <th className="px-6 py-4 font-medium">Category</th>
              <th className="px-6 py-4 font-medium">Price</th>
              <th className="px-6 py-4 font-medium">Stock</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    <span>Loading products from API...</span>
                  </div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-surface-hover/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-md overflow-hidden bg-surface-hover flex-shrink-0 border border-border">
                        <img 
                          src={product.image || product.images?.[0] || "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=400&auto=format&fit=crop"} 
                          alt={product.name || product.title || "Product"} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <span className="font-medium text-foreground">{product.name || product.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{product.category || "Apparel"}</td>
                  <td className="px-6 py-4 text-foreground font-medium">${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}</td>
                  <td className="px-6 py-4">
                    <span className={(product.stock || product.inventoryCount || 0) < 20 ? "text-amber-500 font-medium" : "text-foreground"}>
                      {product.stock || product.inventoryCount || 0} in stock
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {product.status || "Active"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <button 
                      onClick={() => toggleActions(product.id)}
                      className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-surface-hover transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    
                    <AnimatePresence>
                      {openActionId === product.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-8 top-12 w-56 bg-surface border border-border rounded-lg shadow-xl py-2 z-20 text-left"
                        >
                          <Link href="/products/edit" className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-surface-hover hover:text-accent transition-colors">
                            <Edit className="w-4 h-4 mr-3" /> Edit
                          </Link>
                          <button onClick={() => openVto(product)} className="w-full flex items-center px-4 py-2 text-sm text-foreground hover:bg-surface-hover hover:text-accent transition-colors">
                            <Shirt className="w-4 h-4 mr-3" /> Virtual Try-On
                          </button>
                          <button className="w-full flex items-center px-4 py-2 text-sm text-foreground hover:bg-surface-hover hover:text-accent transition-colors">
                            <Video className="w-4 h-4 mr-3" /> Generate AI Video
                          </button>
                          <div className="h-px bg-border my-1" />
                          <button 
                            onClick={() => handleDelete(product.id)}
                            className="w-full flex items-center px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash className="w-4 h-4 mr-3" /> Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {vtoProduct && (
        <VirtualTryOnModal 
          isOpen={!!vtoProduct} 
          onClose={() => setVtoProduct(null)} 
          productImage={vtoProduct.image} 
          productName={vtoProduct.name} 
        />
      )}
    </div>
  );
}

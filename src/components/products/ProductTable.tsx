"use client";

import { useState } from "react";
import { MoreHorizontal, Edit, Trash, Video, Image as ImageIcon, Box, Shirt } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { VirtualTryOnModal } from "@/components/products/VirtualTryOnModal";

const mockProducts = [
  {
    id: "1",
    name: "Classic Silk Shirt",
    sku: "SH-SLK-001",
    price: "$245.00",
    stock: 45,
    status: "Active",
    lastUpdated: "2 hours ago",
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=200&auto=format&fit=crop"
  },
  {
    id: "2",
    name: "Cashmere Turtleneck",
    sku: "SW-CSH-002",
    price: "$380.00",
    stock: 12,
    status: "Active",
    lastUpdated: "1 day ago",
    image: "https://images.unsplash.com/photo-1624542313043-30df84aee15d?q=80&w=200&auto=format&fit=crop"
  }
];

export function ProductTable() {
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [vtoProduct, setVtoProduct] = useState<{name: string, image: string} | null>(null);

  const toggleActions = (id: string) => {
    setOpenActionId(openActionId === id ? null : id);
  };

  const openVto = (product: {name: string, image: string}) => {
    setVtoProduct(product);
    setOpenActionId(null);
  };

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden mt-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-surface-hover/50 border-b border-border">
            <tr>
              <th className="px-6 py-4 font-medium">Product</th>
              <th className="px-6 py-4 font-medium">SKU</th>
              <th className="px-6 py-4 font-medium">Price</th>
              <th className="px-6 py-4 font-medium">Stock</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Last Updated</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockProducts.map((product) => (
              <tr key={product.id} className="hover:bg-surface-hover/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-md overflow-hidden bg-surface-hover flex-shrink-0 border border-border">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="font-medium text-foreground">{product.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{product.sku}</td>
                <td className="px-6 py-4 text-foreground font-medium">{product.price}</td>
                <td className="px-6 py-4">
                  <span className={product.stock < 20 ? "text-amber-500" : "text-foreground"}>
                    {product.stock} in stock
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {product.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{product.lastUpdated}</td>
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
                        <Link href={`/products/edit/${product.id}`} className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-surface-hover hover:text-accent transition-colors">
                          <Edit className="w-4 h-4 mr-3" /> Edit
                        </Link>
                        <button className="w-full flex items-center px-4 py-2 text-sm text-foreground hover:bg-surface-hover hover:text-accent transition-colors">
                          <ImageIcon className="w-4 h-4 mr-3" /> Manage Media
                        </button>
                        <button onClick={() => openVto(product)} className="w-full flex items-center px-4 py-2 text-sm text-foreground hover:bg-surface-hover hover:text-accent transition-colors">
                          <Shirt className="w-4 h-4 mr-3" /> Virtual Try-On
                        </button>
                        <button className="w-full flex items-center px-4 py-2 text-sm text-foreground hover:bg-surface-hover hover:text-accent transition-colors">
                          <Video className="w-4 h-4 mr-3" /> Generate AI Video
                        </button>
                        <button className="w-full flex items-center px-4 py-2 text-sm text-foreground hover:bg-surface-hover hover:text-accent transition-colors">
                          <Box className="w-4 h-4 mr-3" /> Manage 3D
                        </button>
                        <div className="h-px bg-border my-1" />
                        <button className="w-full flex items-center px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                          <Trash className="w-4 h-4 mr-3" /> Delete
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </td>
              </tr>
            ))}
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

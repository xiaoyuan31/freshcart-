/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Check, ShoppingCart, X, Info, LogOut, User, Lock, Mail } from "lucide-react";
import { supabase } from "./supabase";
import { Session } from "@supabase/supabase-js";

interface GroceryItem {
  id: string;
  name: string;
  note: string;
  checked: boolean;
  created_at: string;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchItems();
      // Subscribe to realtime changes
      const channel = supabase
        .channel('grocery_items_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'grocery_items' }, () => {
          fetchItems();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session]);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("grocery_items")
      .select("*")
      .order("checked", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching items:", error);
    } else {
      setItems(data || []);
    }
    setIsLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Check your email for the confirmation link!");
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setItems([]);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const { error } = await supabase
      .from("grocery_items")
      .insert([{ name: newName, note: newNote, user_id: session?.user.id }]);

    if (error) {
      console.error("Error adding item:", error);
    } else {
      setNewName("");
      setNewNote("");
      setIsAdding(false);
      fetchItems();
    }
  };

  const toggleItem = async (id: string, currentChecked: boolean) => {
    const newChecked = !currentChecked;
    
    // Optimistic update
    setItems(prev => {
      const updated = prev.map(item => 
        item.id === id ? { ...item, checked: newChecked } : item
      );
      return [...updated].sort((a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1));
    });

    const { error } = await supabase
      .from("grocery_items")
      .update({ checked: newChecked })
      .eq("id", id);

    if (error) {
      console.error("Error toggling item:", error);
      fetchItems();
    }
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    const { error } = await supabase
      .from("grocery_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting item:", error);
      fetchItems();
    }
  };

  const clearChecked = async () => {
    if (!confirm("Clear all checked items?")) return;
    const { error } = await supabase
      .from("grocery_items")
      .delete()
      .eq("checked", true);

    if (error) {
      console.error("Error clearing checked items:", error);
    } else {
      fetchItems();
    }
  };

  const seedSampleData = async () => {
    setIsLoading(true);
    const sampleItems = [
      { name: "Oat Milk", note: "2 cartons, unsweetened", user_id: session?.user.id },
      { name: "Avocados", note: "Ripe ones", user_id: session?.user.id },
      { name: "Sourdough Bread", note: "Freshly baked", user_id: session?.user.id },
      { name: "Coffee Beans", note: "Whole bean, dark roast", user_id: session?.user.id },
      { name: "Spinach", note: "Organic", user_id: session?.user.id },
      { name: "Greek Yogurt", note: "Plain, large tub", user_id: session?.user.id },
    ];

    const { error } = await supabase
      .from("grocery_items")
      .insert(sampleItems);

    if (error) {
      console.error("Error seeding sample data:", error);
    } else {
      fetchItems();
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-xl border border-slate-100"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <ShoppingCart className="text-primary" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">FreshCart</h1>
            <p className="text-slate-500 mt-1">Family Grocery List</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl p-4 pl-12 transition-all outline-none"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl p-4 pl-12 transition-all outline-none"
                required
              />
            </div>

            {authError && (
              <p className="text-red-500 text-sm font-medium px-2">{authError}</p>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isLoading ? "Processing..." : authMode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
              className="text-primary font-semibold hover:underline"
            >
              {authMode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md px-6 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="text-primary" size={28} />
            FreshCart
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 text-sm font-medium">
              {items.filter(i => !i.checked).length} items remaining
            </p>
            <span className="text-slate-300">•</span>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <LogOut size={12} /> Logout
            </button>
          </div>
        </div>
        {items.some(i => i.checked) && (
          <button 
            onClick={clearChecked}
            className="text-slate-400 hover:text-red-500 transition-colors p-2"
            title="Clear checked items"
          >
            <Trash2 size={20} />
          </button>
        )}
      </header>

      {/* List */}
      <main className="flex-1 px-6 space-y-3">
        {isLoading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p>Loading your list...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Plus className="text-slate-300" size={40} />
            </div>
            <h3 className="text-xl font-semibold text-slate-800">Your list is empty</h3>
            <p className="text-slate-500 mt-2 max-w-[200px] mb-8">Add items you need for your next shopping trip.</p>
            <button 
              onClick={seedSampleData}
              className="text-primary font-bold text-sm uppercase tracking-widest bg-primary/5 px-6 py-3 rounded-2xl hover:bg-primary/10 transition-colors"
            >
              Seed Sample Data
            </button>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`item-card ${item.checked ? 'checked' : ''}`}
              >
                <button 
                  onClick={() => toggleItem(item.id, item.checked)}
                  className={`checkbox-custom ${item.checked ? 'checked' : ''}`}
                >
                  {item.checked && <Check size={14} className="text-white" />}
                </button>
                
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => toggleItem(item.id, item.checked)}
                >
                  <h4 className={`font-semibold text-lg transition-all ${item.checked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {item.name}
                  </h4>
                  {item.note && (
                    <p className={`text-sm mt-0.5 flex items-center gap-1 ${item.checked ? 'text-slate-300' : 'text-slate-500'}`}>
                      <Info size={12} /> {item.note}
                    </p>
                  )}
                </div>

                <button 
                  onClick={() => deleteItem(item.id)}
                  className="text-slate-300 hover:text-red-400 transition-colors p-2"
                >
                  <X size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </main>

      {/* Floating Action Button */}
      {!isAdding && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsAdding(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary-dark transition-colors z-40"
        >
          <Plus size={32} />
        </motion.button>
      )}

      {/* Add Item Modal/Sheet */}
      <AnimatePresence>
        {isAdding && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-8 z-50 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8" />
              <h2 className="text-2xl font-bold mb-6">Add New Item</h2>
              <form onSubmit={addItem} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Item Name</label>
                  <input 
                    ref={inputRef}
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Oat Milk"
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl p-4 text-lg transition-all outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Note (Optional)</label>
                  <input 
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g. 2 cartons, unsweetened"
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-primary focus:bg-white rounded-2xl p-4 text-lg transition-all outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-primary text-white font-bold py-4 rounded-2xl hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
                  >
                    Add to List
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


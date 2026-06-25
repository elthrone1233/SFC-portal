import React, { useState, useEffect, useRef } from "react";
import { HeartPulse, Menu, X, ArrowRight, Phone, ShieldCheck, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NavbarProps {
  onScrollTo: (elementId: string) => void;
  activeSection: string;
  onOpenAdmin: () => void;
  onOpenPortal: () => void;
  clinicPhone: string;
}

export default function Navbar({ onScrollTo, activeSection, onOpenAdmin, onOpenPortal, clinicPhone }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-expand mobile Services accordion if sub-item is active
  useEffect(() => {
    if (["services", "checker", "appointment"].includes(activeSection)) {
      setIsMobileServicesOpen(true);
    }
  }, [activeSection]);

  // Click outside to close the desktop services dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const servicesDropdownItems = [
    { name: "Our Services", id: "services" },
    { name: "Symptom Checker", id: "checker" },
    { name: "Quick Appointment", id: "appointment" },
  ];

  const handleLinkClick = (id: string) => {
    if (id === "patient-portal") {
      onOpenPortal();
      setIsOpen(false);
      return;
    }
    onScrollTo(id);
    setIsOpen(false);
  };

  const isServicesDropdownActive = ["services", "checker", "appointment"].includes(activeSection);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-18">
          {/* Left: Brand Identity */}
          <div 
            onClick={() => handleLinkClick("home")}
            className="flex items-center space-x-3 cursor-pointer group"
            id="brand-logo"
          >
            <div className="bg-[#057A70] p-2.5 rounded-xl text-white transition-transform group-hover:scale-105">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <div className="font-extrabold text-lg text-slate-900 tracking-tight leading-none group-hover:text-[#057A70] transition-colors uppercase">
                SAINT FRANCIS
              </div>
              <div className="text-xs font-semibold text-[#057A70] tracking-widest mt-0.5">
                CLINIC
              </div>
            </div>
          </div>

          {/* Center: Nav links */}
          <nav className="hidden lg:flex items-center space-x-8">
            {/* Home */}
            <button
              onClick={() => handleLinkClick("home")}
              className={`relative text-sm font-medium tracking-tight py-2 transition-colors cursor-pointer ${
                activeSection === "home" ? "text-[#057A70]" : "text-slate-600 hover:text-[#057A70]"
              }`}
            >
              Home
              {activeSection === "home" && (
                <motion.span
                  layoutId="navUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#057A70] rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>

            {/* Services Dropdown */}
            <div 
              ref={dropdownRef}
              className="relative py-2"
            >
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`relative flex items-center space-x-1 text-sm font-medium tracking-tight py-2 transition-colors cursor-pointer ${
                  isServicesDropdownActive ? "text-[#057A70]" : "text-slate-600 hover:text-[#057A70]"
                }`}
              >
                <span>Services</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                {isServicesDropdownActive && (
                  <motion.span
                    layoutId="navUnderline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#057A70] rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-1 w-56 rounded-2xl bg-white border border-slate-100 shadow-xl overflow-hidden z-50 py-1.5"
                  >
                    {servicesDropdownItems.map((item) => {
                      const isSubActive = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            handleLinkClick(item.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center justify-between ${
                            isSubActive 
                              ? "bg-[#057A70]/5 text-[#057A70]" 
                              : "text-slate-700 hover:bg-slate-50 hover:text-[#057A70]"
                          }`}
                        >
                          <span>{item.name}</span>
                          {isSubActive && <div className="h-1.5 w-1.5 rounded-full bg-[#057A70]" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Remaining Static Links */}
            {["doctors", "patient-portal", "testimonials"].map((id) => {
              const name = id === "patient-portal" ? "Patient Portal" : id === "doctors" ? "Our Doctors" : "Testimonials";
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={() => handleLinkClick(id)}
                  className={`relative text-sm font-medium tracking-tight py-2 transition-colors cursor-pointer ${
                    isActive ? "text-[#057A70]" : "text-slate-600 hover:text-[#057A70]"
                  }`}
                >
                  {name}
                  {isActive && (
                    <motion.span
                      layoutId="navUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#057A70] rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Urgent CTA */}
          <div className="hidden md:flex items-center space-x-3.5">
            <button
              onClick={onOpenAdmin}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition"
              title="Admin Console"
              id="admin-console-trigger-desktop"
            >
              <ShieldCheck className="h-4.5 w-4.5 text-[#057A70]" />
            </button>
            <button
              onClick={() => handleLinkClick("appointment")}
              className="inline-flex items-center justify-center space-x-2 bg-[#057A70] hover:bg-opacity-95 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-md hover:shadow-lg transition cursor-pointer"
              id="cta-emergency"
            >
              <Phone className="h-4 w-4" />
              <span>{clinicPhone}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Burger trigger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-[#057A70] hover:bg-slate-50 transition"
            aria-label="Toggle Menu"
            id="burger-trigger"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-slate-50 border-b border-slate-100 overflow-hidden"
            id="mobile-drawer"
          >
            <div className="px-4 pt-3 pb-6 space-y-2">
              {/* Home Link */}
              <button
                onClick={() => handleLinkClick("home")}
                className={`block w-full text-left px-4 py-3 rounded-xl text-base font-semibold transition ${
                  activeSection === "home"
                    ? "bg-[#057A70] text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-[#057A70]"
                }`}
              >
                Home
              </button>

              {/* Services Accordion Link */}
              <div className="space-y-1">
                <button
                  onClick={() => setIsMobileServicesOpen(!isMobileServicesOpen)}
                  className={`flex w-full items-center justify-between px-4 py-3 rounded-xl text-base font-semibold transition cursor-pointer ${
                    isServicesDropdownActive
                      ? "bg-[#057A70]/10 text-[#057A70]"
                      : "text-slate-700 hover:bg-slate-100 hover:text-[#057A70]"
                  }`}
                >
                  <span>Services</span>
                  <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isMobileServicesOpen ? "rotate-180" : ""}`} />
                </button>
                
                <AnimatePresence>
                  {isMobileServicesOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pl-4 space-y-1 overflow-hidden"
                    >
                      {servicesDropdownItems.map((item) => {
                        const isItemActive = activeSection === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              handleLinkClick(item.id);
                              setIsOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                              isItemActive
                                ? "bg-[#057A70] text-white"
                                : "text-slate-600 hover:bg-slate-100/80 hover:text-[#057A70]"
                            }`}
                          >
                            {item.name}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Remaining Mobile Links */}
              {["doctors", "patient-portal", "testimonials"].map((id) => {
                const name = id === "patient-portal" ? "Patient Portal" : id === "doctors" ? "Our Doctors" : "Testimonials";
                const isActive = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleLinkClick(id)}
                    className={`block w-full text-left px-4 py-3 rounded-xl text-base font-semibold transition ${
                      isActive
                        ? "bg-[#057A70] text-white"
                        : "text-slate-700 hover:bg-slate-100 hover:text-[#057A70]"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}

              {/* Drawer Secondary CTAs */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenAdmin();
                  }}
                  className="flex w-full items-center justify-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition"
                >
                  <ShieldCheck className="h-4.5 w-4.5 text-[#057A70]" />
                  <span>Admin Panel login</span>
                </button>
                <button
                  onClick={() => handleLinkClick("appointment")}
                  className="flex w-full items-center justify-center space-x-2 bg-[#057A70] text-white py-3 rounded-xl font-bold"
                >
                  <Phone className="h-5 w-5" />
                  <span>Call to Book: {clinicPhone}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

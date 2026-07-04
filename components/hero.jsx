"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

const HeroSection = () => {
  const imageRef = useRef(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const imageElement = imageRef.current;
    
    if (!imageElement) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const scrollThreshold = 100;

      if (scrollPosition > scrollThreshold) {
        imageElement.classList.add("scrolled");
      } else {
        imageElement.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-12 md:mb-0">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight dark:text-white">
              Manage Your{" "}
              <span className="gradient-title">Finances</span> with Ease
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-lg">
              Track expenses, set budgets, and gain insights into your spending
              habits with our intuitive finance management platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started
                </Button>
              </Link>
              <Link href="#features">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto dark:border-gray-700 dark:text-gray-300"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
          <div className="md:w-1/2 hero-image-wrapper">
            <div className="relative hero-image" ref={imageRef}>
              <div className="relative w-full h-[400px] rounded-lg overflow-hidden">
                {!imageError ? (
                  <Image
                    src="/dashboard-preview.png"
                    alt="Dashboard Preview"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="rounded-lg shadow-2xl object-contain"
                    priority
                    onError={(e) => {
                      console.error('Image failed to load:', e);
                      setImageError(true);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <p>Image failed to load</p>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-4 -right-3 sm:-bottom-6 sm:-right-4 bg-white dark:bg-gray-800 p-1 sm:p-2 rounded-lg shadow-lg">
                <p className="text-sm font-medium dark:text-white">Total Savings</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">₹12,580</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
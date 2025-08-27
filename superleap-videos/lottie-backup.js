 
document.addEventListener("DOMContentLoaded", function () {
  console.log("🌎 DOM Loaded");

  /* -----------------------
     ANIMATION POOL MANAGER
  ----------------------- */
  class LottieAnimationManager {
    constructor(maxPoolSize = 10) {
      this.pool = [];
      this.active = new Map();
      this.scrollTriggers = new Set();
      this.maxPoolSize = maxPoolSize;
      this.loadingPromises = new Map();
      this.debounceTimers = new Map();
    }

    // Get or create animation with pooling
    async getAnimation(container, path, options = {}) {
      const key = `${path}-${JSON.stringify(options)}`;
      
      // Prevent duplicate loads
      if (this.loadingPromises.has(key)) {
        return this.loadingPromises.get(key);
      }

      const promise = this._createOrReuseAnimation(container, path, options);
      this.loadingPromises.set(key, promise);
      
      try {
        const result = await promise;
        return result;
      } finally {
        this.loadingPromises.delete(key);
      }
    }

    async _createOrReuseAnimation(container, path, options) {
      // Clear container first
      this._clearContainer(container);

      // For now, always create new animations to avoid Lottie API issues
      // Pool will store destroyed animations for cleanup tracking only
      console.log("🎬 Creating new animation:", path);
      const animation = lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: options.loop === true, // Default to false, only loop if explicitly set
        autoplay: options.autoplay !== false,
        path,
        ...options
      });

      const poolItem = {
        animation,
        path,
        inUse: true,
        container
      };

      this.active.set(container, poolItem);
      
      // Clean up old animations if pool is full
      if (this.pool.length >= this.maxPoolSize) {
        const oldest = this.pool.shift();
        if (oldest && oldest.animation && !oldest.inUse) {
          try {
            oldest.animation.destroy();
          } catch (e) {
            console.warn("Error destroying old animation:", e);
          }
        }
      }
      this.pool.push(poolItem);

      return animation;
    }

    // Properly release animation back to pool
    releaseAnimation(container) {
      const poolItem = this.active.get(container);
      if (!poolItem) return;

      console.log("🔄 Releasing animation to pool");
      
      // Stop and destroy animation immediately for memory saving
      poolItem.animation.stop();
      poolItem.animation.destroy();
      
      // Clear container
      this._clearContainer(container);
      
      // Remove from active and pool completely
      this.active.delete(container);
      const poolIndex = this.pool.indexOf(poolItem);
      if (poolIndex > -1) {
        this.pool.splice(poolIndex, 1);
      }
    }

    // Completely destroy animation (for cleanup)
    destroyAnimation(container) {
      const poolItem = this.active.get(container);
      if (!poolItem) return;

      console.log("🗑️ Destroying animation");
      
      // Remove from pool
      const poolIndex = this.pool.indexOf(poolItem);
      if (poolIndex > -1) {
        this.pool.splice(poolIndex, 1);
      }

      // Destroy animation
      poolItem.animation.destroy();
      this._clearContainer(container);
      this.active.delete(container);
    }

    // Clear container contents safely
    _clearContainer(container) {
      if (container) {
        // Remove all child nodes
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
    }

    // Debounced operation helper
    debounce(key, fn, delay = 200) {
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
      }
      
      const timer = setTimeout(() => {
        fn();
        this.debounceTimers.delete(key);
      }, delay);
      
      this.debounceTimers.set(key, timer);
    }

    // Clean up everything
    destroy() {
      console.log("🧹 Destroying Animation Manager");
      
      // Clear all debounce timers
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();

      // Destroy all scroll triggers
      this.scrollTriggers.forEach(trigger => trigger.kill());
      this.scrollTriggers.clear();

      // Destroy all animations
      this.pool.forEach(item => {
        if (item.animation) {
          item.animation.destroy();
        }
      });

      this.active.forEach(item => {
        if (item.animation) {
          item.animation.destroy();
        }
      });

      // Clear all references
      this.pool = [];
      this.active.clear();
      this.loadingPromises.clear();
    }
  }

  /* -----------------------
     LOAD LIBRARIES
  ----------------------- */
  function loadLottieLib(cb) {
    if (window.lottie) {
      console.log("✅ Lottie already loaded");
      return cb();
    }
    console.log("📦 Loading Lottie library...");
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.0/lottie.min.js";
    script.onload = () => {
      console.log("✅ Lottie library loaded");
      cb();
    };
    script.onerror = () => console.error("❌ Failed to load Lottie");
    document.body.appendChild(script);
  }

  function loadGSAP(cb) {
    if (window.gsap && window.ScrollTrigger) {
      console.log("✅ GSAP + ScrollTrigger already loaded");
      return cb();
    }
    console.log("📦 Loading GSAP + ScrollTrigger...");
    const gsapScript = document.createElement("script");
    gsapScript.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
    gsapScript.onerror = () => console.error("❌ Failed to load GSAP");
    document.body.appendChild(gsapScript);

    const stScript = document.createElement("script");
    stScript.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js";
    stScript.onload = () => {
      console.log("✅ GSAP + ScrollTrigger loaded");
      cb();
    };
    stScript.onerror = () => console.error("❌ Failed to load ScrollTrigger");
    document.body.appendChild(stScript);
  }

  /* -----------------------
     INITIALIZE
  ----------------------- */
  loadLottieLib(() => {
    loadGSAP(() => {
      gsap.registerPlugin(ScrollTrigger);
      console.log("🚀 Init started");

      // Create global animation manager with smaller pool
      const animationManager = new LottieAnimationManager(5); // Reduced from 15 to 5

      /* -----------------------
         1. GENERIC .lottie HANDLER (Exclude menu wraps)
      ----------------------- */
      document.querySelectorAll('.lottie:not([fd-code="menu-img-wrap"])').forEach(el => {
        console.log("📍 Found .lottie element", el);
        
        const trigger = ScrollTrigger.create({
          trigger: el,
          start: "top 80%",
          end: "bottom 20%",
          onEnter: () => {
            console.log("▶️ Enter view:", el);
            if (
              el.classList.contains("active") ||
              el.classList.contains("w-tab-active") ||
              el.classList.contains("w--tab-active")
            ) {
              console.log("✅ Loading animation:", el);
              const path = el.dataset.path;
              if (path) {
                animationManager.getAnimation(el, path, { autoplay: true })
                  .then(animation => {
                    animation.play();
                  })
                  .catch(err => console.error("❌ Animation load failed:", err));
              }
            } else {
              console.log("⏸ Skipped (not active):", el);
            }
          },
          onLeave: () => {
            console.log("⏹ Leave view:", el);
            animationManager.releaseAnimation(el);
          },
          onEnterBack: () => {
            console.log("🔄 Enter back:", el);
            if (
              el.classList.contains("active") ||
              el.classList.contains("w-tab-active") ||
              el.classList.contains("w--tab-active")
            ) {
              console.log("✅ Loading animation on enter back:", el);
              const path = el.dataset.path;
              if (path) {
                animationManager.getAnimation(el, path, { autoplay: true })
                  .then(animation => {
                    animation.play();
                  })
                  .catch(err => console.error("❌ Animation reload failed:", err));
              }
            } else {
              console.log("⏸ Skipped enter back (not active):", el);
            }
          }
        });
        
        animationManager.scrollTriggers.add(trigger);
      });

      /* -----------------------
         2. MENU HANDLER
      ----------------------- */
      const menuLinks = document.querySelectorAll('[fd-code="menu-link"]');
      console.log("📍 Menu links found:", menuLinks.length);
      const imgWraps = document.querySelectorAll('[fd-code="menu-img-wrap"]');
      let activeMenuContainer = null;

      function loadAndActivate(wrap) {
        return animationManager.debounce('menu-switch', async () => {
          const lottieContainer = wrap.querySelector('[fd-code="menu-lottie"]');
          const path = lottieContainer?.dataset.lottiePath;
          console.log("🎬 Load menu lottie:", path);
          
          if (!lottieContainer || !path) return;

          // Release previous menu animation
          if (activeMenuContainer && activeMenuContainer !== lottieContainer) {
            animationManager.releaseAnimation(activeMenuContainer);
          }

          try {
            await animationManager.getAnimation(lottieContainer, path, { autoplay: true });
            activeMenuContainer = lottieContainer;

            // Update active states
            imgWraps.forEach(w => w.classList.remove("active"));
            wrap.classList.add("active");
          } catch (err) {
            console.error("❌ Menu animation failed:", err);
          }
        }, 150);
      }

      menuLinks.forEach(link => {
        const sourceText = link.querySelector('[fd-code="menu-text-source"]')?.textContent.trim();
        console.log("🔗 Menu link source:", sourceText);

        link.addEventListener("click", () => {
          console.log("👆 Click menu link:", sourceText);
          
          // Update active states immediately for UI responsiveness
          menuLinks.forEach(l => l.classList.remove("active"));
          link.classList.add("active");

          const targetWrap = Array.from(imgWraps).find(wrap => {
            return (
              wrap.querySelector('[fd-code="menu-text-destination"]')?.textContent.trim() ===
              sourceText
            );
          });

          if (targetWrap) loadAndActivate(targetWrap);
        });
      });

      if (menuLinks[0]) {
        console.log("👉 Auto-clicking first menu link");
        menuLinks[0].click();
      }

      /* -----------------------
         3. PRODUCT TAB HANDLER
      ----------------------- */
      let activeTabContainer = null;

      function updateTabAnimations() {
        return animationManager.debounce('tab-update', async () => {
          console.log("🔄 Updating tab animations");
          
          let newActiveContainer = null;

          // Find the currently active tab
          document.querySelectorAll(".product-tab-box").forEach(box => {
            const container = box.querySelector("[id^='product-']");
            const isActive = box.closest(".w-tab-pane")?.classList.contains("w--tab-active");

            if (isActive && container) {
              newActiveContainer = container;
            }
          });

          // Switch animations if needed
          if (newActiveContainer && newActiveContainer !== activeTabContainer) {
            console.log("✅ Switching to new active tab");
            
            // Release old animation
            if (activeTabContainer) {
              animationManager.releaseAnimation(activeTabContainer);
            }

            // Load new animation
            const path = newActiveContainer.getAttribute("data-lottie-path");
            if (path) {
              try {
                await animationManager.getAnimation(newActiveContainer, path, { autoplay: true });
                activeTabContainer = newActiveContainer;
              } catch (err) {
                console.error("❌ Tab animation failed:", err);
              }
            }
          }
        }, 100);
      }

      document.querySelectorAll(".product-tab-link").forEach(tab => {
        tab.addEventListener("click", () => {
          console.log("👆 Click tab link");
          updateTabAnimations();
        });
      });

      // Initial tab setup
      setTimeout(() => updateTabAnimations(), 200);

      /* -----------------------
         4. CLEANUP & ERROR HANDLING
      ----------------------- */
      function cleanup() {
        console.log("🧹 Full cleanup initiated");
        animationManager.destroy();
        
        // Force garbage collection hint
        if (window.gc) {
          window.gc();
        }
      }

      // Cleanup on page unload
      window.addEventListener("pagehide", cleanup);
      window.addEventListener("beforeunload", cleanup);

      // Handle visibility changes
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          console.log("🙈 Page hidden -> pause animations");
          // Pause active animations to save resources
          animationManager.active.forEach(item => {
            if (item.animation && !item.animation.isPaused) {
              item.animation.pause();
            }
          });
        } else {
          console.log("👀 Page visible -> resume");
          // Resume animations
          animationManager.active.forEach(item => {
            if (item.animation && item.animation.isPaused) {
              item.animation.play();
            }
          });
          ScrollTrigger.refresh();
          setTimeout(() => updateTabAnimations(), 200);
        }
      });

      // Error handling
      window.addEventListener("error", (e) => {
        if (e.message && e.message.includes("lottie")) {
          console.error("🚨 Lottie error detected:", e);
          // Could implement recovery logic here
        }
      });

      // Memory monitoring with forced cleanup
      if (window.performance && window.performance.memory) {
        setInterval(() => {
          const memory = window.performance.memory;
          const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
          const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
          console.log(`📊 Memory: ${usedMB}MB / ${totalMB}MB`);
          
          // Aggressive cleanup if memory too high
          if (usedMB > 350) {
            console.log("🚨 High memory detected - forcing cleanup");
            
            // Only destroy animations, keep manager intact
            if (this.active && this.active.forEach) {
              this.active.forEach((item, container) => {
                if (item && item.animation) {
                  try {
                    item.animation.stop();
                    item.animation.destroy();
                  } catch (e) {
                    console.warn("Error destroying animation:", e);
                  }
                  this._clearContainer(container);
                }
              });
            }
            
            // Clear references but keep manager structure
            if (this.active && this.active.clear) {
              this.active.clear();
            }
            if (Array.isArray(this.pool)) {
              this.pool = [];
            }
            
            // Clear timers and promises
            if (this.loadingPromises && this.loadingPromises.clear) {
              this.loadingPromises.clear();
            }
            if (this.debounceTimers && this.debounceTimers.forEach) {
              this.debounceTimers.forEach(timer => clearTimeout(timer));
              this.debounceTimers.clear();
            }
            
            // Reset active containers to null
            activeMenuContainer = null;
            activeTabContainer = null;
            
            // Garbage collection hint
            if (window.gc) {
              setTimeout(() => window.gc(), 500);
            }
            
            console.log("🧹 Cleanup completed - animations destroyed, manager preserved");
          }
        }, 5000); // Check every 5 seconds instead of 10
      }

      console.log("🎉 Initialization complete with memory optimization");
    });
  });





























  
document.addEventListener("DOMContentLoaded", function () {
  // Dynamically load Lottie once
  function loadLottieLib(cb) {
    if (window.lottie) return cb();
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.0/lottie.min.js";
    script.onload = cb;
    document.body.appendChild(script);
  }

  loadLottieLib(() => {
    /* -----------------------
       1. GENERIC .lottie HANDLER
    ----------------------- */
    const lottieMap = new Map();

    document.querySelectorAll(".lottie").forEach(el => {
      const anim = lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: true,
        autoplay: false,
        path: el.dataset.path
      });
      lottieMap.set(el, anim);
    });

    function updateLotties() {
      lottieMap.forEach((anim, el) => {
        if (
          el.classList.contains("active") ||
          el.classList.contains("w-tab-active") ||
          el.classList.contains("w--tab-active")
        ) {
          anim.goToAndPlay(0, true);
        } else {
          anim.stop();
        }
      });
    }

    const observer = new MutationObserver(updateLotties);
    document.querySelectorAll(".lottie").forEach(el => {
      observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    });
    updateLotties();

    /* -----------------------
       2. MENU HANDLER
    ----------------------- */
    const menuLinks = document.querySelectorAll('[fd-code="menu-link"]');
    const imgWraps = document.querySelectorAll('[fd-code="menu-img-wrap"]');
    let activeMenuAnim = null;

    function loadAndActivate(wrap, loop = false) {
      const lottieContainer = wrap.querySelector('[fd-code="menu-lottie"]');
      const path = lottieContainer?.dataset.lottiePath;
      if (!lottieContainer || !path) return;

      if (activeMenuAnim) {
        activeMenuAnim.destroy();
        activeMenuAnim = null;
      }

      activeMenuAnim = lottie.loadAnimation({
        container: lottieContainer,
        renderer: "svg",
       // loop,
        autoplay: true,
        path
      });

      imgWraps.forEach(w => w.classList.remove("active"));
      wrap.classList.add("active");
    }

    menuLinks.forEach(link => {
      const sourceText = link.querySelector('[fd-code="menu-text-source"]')?.textContent.trim();
      if (!sourceText) return;

      link.addEventListener("click", () => {
        menuLinks.forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        const targetWrap = Array.from(imgWraps).find(wrap => {
          return wrap.querySelector('[fd-code="menu-text-destination"]')?.textContent.trim() === sourceText;
        });

        if (targetWrap) loadAndActivate(targetWrap, false);
      });
    });

    if (menuLinks[0]) menuLinks[0].click();

    /* -----------------------
       3. PRODUCT TAB HANDLER
    ----------------------- */
    let activeTabAnim = null;
    let activeTabContainer = null;

    function loadTabLottie(container) {
      const path = container.getAttribute("data-lottie-path");
      if (!path) return null;

      return lottie.loadAnimation({
        container,
        renderer: "svg",
       // loop: true,
        autoplay: true,
        path
      });
    }

    function updateTabAnimations() {
      document.querySelectorAll(".product-tab-box").forEach(box => {
        const container = box.querySelector("[id^='product-']");
        const isActive = box.closest(".w-tab-pane")?.classList.contains("w--tab-active");

        if (isActive) {
          if (activeTabAnim && activeTabContainer !== container) {
            activeTabAnim.destroy();
            activeTabAnim = null;
          }
          if (!activeTabAnim) {
            activeTabAnim = loadTabLottie(container);
            activeTabContainer = container;
          }
        }
      });
    }

    document.querySelectorAll(".product-tab-link").forEach(tab => {
      tab.addEventListener("click", () => {
        setTimeout(updateTabAnimations, 200);
      });
    });

    setTimeout(updateTabAnimations, 200);

    /* -----------------------
       CLEANUP
    ----------------------- */
    window.addEventListener("pagehide", () => {
      observer.disconnect();
      lottieMap.forEach(anim => anim.destroy());
      lottieMap.clear();

      if (activeMenuAnim) activeMenuAnim.destroy();
      if (activeTabAnim) activeTabAnim.destroy();
    });
  });
});


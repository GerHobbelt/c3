      function start_profiling() {
        if (console.profile) {
          console.profile('C3 demo run');
        }
      }
      function stop_profiling() {
        if (console.profileEnd) {
          console.profileEnd('C3 demo run');
        }
      }
      var prof_timer_h = null;
      var prof_timestamp = Date.now();
      function debounce_profile_stop(t) {
        clearTimeout(prof_timer_h);
        t = Math.max(t | 0, 5179);
        
        // make sure the farthest-into-the-future delay is kept intact:
        var new_t = Date.now() + t;
        var delta_t = new_t - prof_timestamp;
        if (delta_t < 0) {
          t = prof_timestamp - new_t;
        } else {
          prof_timestamp = new_t;
        }
        
        prof_timer_h = setTimeout(stop_profiling, t);
      }
      start_profiling();

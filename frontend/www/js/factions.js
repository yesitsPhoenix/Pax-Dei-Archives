// js/factions.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://jrjgbnopmfovxwvtbivh.supabase.co/',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY'

);


// Load factions from Supabase and render cards
async function loadFactions() {
    const container = document.getElementById('factionCards');
  
    const factions = ['inquisition', 'zebians', 'scions'];
  
    const { data, error } = await supabase
      .from('pages')
      .select('title, a, description')
      .in('a', factions);
  
    if (error) {
      console.error('Failed to fetch factions:', error);
      container.innerHTML = '<p>Unable to load faction entries.</p>';
      return;
    }
  
    container.innerHTML = data.map(entry => `
      <a href="entry.html?a=${entry.a}" class="card" data-name="${entry.a.toLowerCase()}">
        <h2>${entry.title}</h2>
        <p>${entry.description}</p>
      </a>
    `).join('');
  }
  
  
  // Live search filter
  function setupSearch() {
    const input = document.getElementById('searchInput');
    input.addEventListener('input', function () {
      const query = this.value.toLowerCase();
      const cards = document.querySelectorAll('.card');
  
      cards.forEach(card => {
        const name = card.dataset.name;
        card.style.display = name.includes(query) ? '' : 'none';
      });
    });
  }
  
  // Initialize
  loadFactions().then(setupSearch);

/**
 * Serwis do wyświetlania wyników rozmowy
 */
export class ResultsDisplayService {
  constructor() {
    this.resultsSection = null;
    this.overlay = null;
  }

  /**
   * Wyświetla wyniki rozmowy
   */
  displayResults(results) {
    this.createOverlay();
    this.createResultsSection();
    this.populateResults(results);
  }

  /**
   * Tworzy overlay tło
   */
  createOverlay() {
    this.overlay = document.querySelector('.results-overlay');
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'results-overlay';
      this.overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        backdrop-filter: blur(5px);
      `;
      document.body.appendChild(this.overlay);
    }
  }

  /**
   * Tworzy sekcję wyników
   */
  createResultsSection() {
    this.resultsSection = document.querySelector('.conversation-results');
    if (!this.resultsSection) {
      this.resultsSection = document.createElement('div');
      this.resultsSection.className = 'conversation-results';
      this.resultsSection.innerHTML = `
        <div class="results-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h3 style="margin: 0; font-size: 20px; font-weight: 600;">📊 Wyniki analizy</h3>
          <button class="close-results" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">✕</button>
        </div>
        <div class="results-content"></div>
      `;
      
      this.resultsSection.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ffffff;
        border: 2px solid #e0e0e0;
        border-radius: 16px;
        box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.8);
        max-width: 700px;
        max-height: 85vh;
        overflow-y: auto;
        z-index: 10001;
        padding: 0;
        backdrop-filter: blur(10px);
      `;
      
      document.body.appendChild(this.resultsSection);
      
      this.bindCloseEvents();
    }
  }

  /**
   * Binduje eventy zamykania
   */
  bindCloseEvents() {
    const closeResults = () => {
      this.close();
    };
    
    const closeBtn = this.resultsSection.querySelector('.close-results');
    closeBtn.addEventListener('click', closeResults);
    
    // Hover effect dla przycisku
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.3)';
      closeBtn.style.transform = 'scale(1.1)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.2)';
      closeBtn.style.transform = 'scale(1)';
    });
    
    // Zamknij po kliknięciu w overlay
    if (this.overlay) {
      this.overlay.addEventListener('click', closeResults);
    }
  }

  /**
   * Wypełnia wyniki
   */
  populateResults(results) {
    const content = this.resultsSection.querySelector('.results-content');
    const offers = results?.offers?.items || [];
    
    if (offers.length > 0) {
      const offersHtml = offers.map((offer, index) => {
        const bankName = offer.bank?.name || 'Nieznany bank';
        const title = offer.title || 'Kredyt hipoteczny';
        const interestRate = offer.currencyIndex?.value || 0;
        const monthlyPayment = offer.monthlyInstallment || offer.installment || 0;
        const totalCost = offer.cost.totalCost || offer.total || 0;
        
        return `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <div>
                <h4 style="margin: 0; color: #1a202c; font-size: 18px; font-weight: 600;">${bankName}</h4>
                <p style="margin: 4px 0 0 0; color: #718096; font-size: 14px;">${title}</p>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 16px;">
              <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #4299e1;">
                <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Oprocentowanie</div>
                <div style="font-size: 18px; font-weight: 600; color: #2d3748;">${interestRate.toFixed(2)}%</div>
              </div>
              <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #48bb78;">
                <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Rata miesięczna</div>
                <div style="font-size: 18px; font-weight: 600; color: #2d3748;">${monthlyPayment.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł</div>
              </div>
              <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #ed8936;">
                <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Całkowity koszt</div>
                <div style="font-size: 18px; font-weight: 600; color: #2d3748;">${totalCost.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      content.innerHTML = `
        <div style="padding: 25px;">
          <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 8px 0; color: #2d3748; font-size: 18px;">Znalezione oferty kredytowe (${offers.length})</h4>
            <p style="margin: 0; color: #718096; font-size: 14px;">Poniżej przedstawiamy najlepsze oferty dopasowane do Twoich potrzeb:</p>
          </div>
          ${offersHtml}
        </div>
      `;
    } else {
      content.innerHTML = `
        <div style="padding: 25px; text-align: center;">
          <div style="color: #718096; font-size: 16px;">Brak dostępnych ofert</div>
          <pre style="background: #2d3748; color: #e2e8f0; padding: 20px; border-radius: 12px; overflow-x: auto; white-space: pre-wrap; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 14px; line-height: 1.5; border: 1px solid #4a5568; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); margin-top: 16px; text-align: left;">${JSON.stringify(results, null, 2)}</pre>
        </div>
      `;
    }
  }

  /**
   * Zamyka wyniki
   */
  close() {
    if (this.resultsSection) {
      this.resultsSection.remove();
      this.resultsSection = null;
    }
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  /**
   * Sprawdza czy wyniki są otwarte
   */
  isOpen() {
    return this.resultsSection !== null;
  }
}
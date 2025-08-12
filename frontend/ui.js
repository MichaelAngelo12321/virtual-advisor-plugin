// UI Manager Module - User interface handling

export class UIManager {
    constructor() {
        this.elements = this.setupUIElements();
        this.setupEventListeners();
    }

    setupUIElements() {
        return {
            connectionStatus: document.getElementById('connection-status'),
            sessionStatus: document.getElementById('session-status'),
            micStatus: document.getElementById('mic-status'),
            ttsStatus: document.getElementById('tts-status'),
            transcriptContainer: document.getElementById('transcript-container'),
            startBtn: document.getElementById('start-btn'),
            errorPanel: document.getElementById('error-panel'),
            errorMessage: document.getElementById('error-message'),
            dismissErrorBtn: document.getElementById('dismiss-error'),
            // Elementy modala
            modal: document.getElementById('voice-modal'),
            closeModalBtn: document.getElementById('close-modal'),
            // Elementy formularza email
            emailFormPanel: document.getElementById('email-form-panel'),
            emailInput: document.getElementById('email-input'),
            sendEmailBtn: document.getElementById('send-email-btn'),
            emailStatus: document.getElementById('email-status')
        };
    }

    setupEventListeners() {
        // Event listener dla przycisku dismiss error
        this.elements.dismissErrorBtn.addEventListener('click', () => this.hideError());
        
        // Event listenery dla modala
        this.elements.closeModalBtn.addEventListener('click', () => {
            this.hideModal();
            // Emit custom event for app to handle
            document.dispatchEvent(new CustomEvent('ui:stop-session'));
        });
        
        // Zamknij modal po kliknięciu w tło
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.hideModal();
                // Emit custom event for app to handle
                document.dispatchEvent(new CustomEvent('ui:stop-session'));
            }
        });
        
        // Event listener dla przycisku wysyłania email
        this.elements.sendEmailBtn.addEventListener('click', () => {
            const email = this.getEmailValue();
            if (email) {
                // Emit custom event for app to handle
                document.dispatchEvent(new CustomEvent('ui:send-email', { detail: { email } }));
            } else {
                this.showEmailStatus('Proszę wprowadzić poprawny adres email', false);
            }
        });
    }

    // Set up start button event listener (called from main app)
    setupStartButton(onStart) {
        this.elements.startBtn.addEventListener('click', () => {
            this.showModal();
            onStart();
        });
    }

    // Modal management
    showModal() {
        this.elements.modal.classList.remove('hidden');
    }

    hideModal() {
        this.elements.modal.classList.add('hidden');
    }

    // Connection status management
    setConnectionStatus(connected) {
        this.elements.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
        this.elements.connectionStatus.classList.toggle('connected', connected);
        this.elements.connectionStatus.classList.toggle('disconnected', !connected);
        this.elements.startBtn.disabled = !connected;
    }

    // Session status management
    setSessionActive(active) {
        this.elements.sessionStatus.textContent = active ? 'Active' : 'Inactive';
        this.elements.sessionStatus.classList.toggle('active', active);
        this.elements.sessionStatus.classList.toggle('inactive', !active);
        this.elements.startBtn.disabled = active;
    }

    // Microphone status management
    setMicrophoneReady() {
        this.elements.micStatus.textContent = 'Ready';
        this.elements.micStatus.classList.remove('inactive');
        this.elements.micStatus.classList.add('active');
    }

    // TTS status management
    setTTSStatus(status) {
        switch (status) {
            case 'playing':
                this.elements.ttsStatus.textContent = 'Playing';
                this.elements.ttsStatus.classList.remove('inactive');
                this.elements.ttsStatus.classList.add('playing');
                break;
            case 'interrupted':
                this.elements.ttsStatus.textContent = 'Interrupted';
                this.elements.ttsStatus.classList.remove('playing');
                this.elements.ttsStatus.classList.add('inactive');
                break;
            case 'inactive':
            default:
                this.elements.ttsStatus.textContent = 'Inactive';
                this.elements.ttsStatus.classList.remove('playing');
                this.elements.ttsStatus.classList.add('inactive');
                break;
        }
    }

    // Transcript management
    addTranscript(speaker, text, isPartial = false) {
        const item = document.createElement('div');
        item.className = `transcript-item ${speaker} ${isPartial ? 'partial' : ''}`;
        
        const timestamp = new Date().toLocaleTimeString();
        item.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="speaker ${speaker}">${speaker.charAt(0).toUpperCase() + speaker.slice(1)}</span>
            <span class="text">${text}</span>
        `;
        
        if (isPartial) {
            // Replace existing partial
            const existing = this.elements.transcriptContainer.querySelector('.transcript-item.partial');
            if (existing) {
                this.elements.transcriptContainer.removeChild(existing);
            }
        }

        this.elements.transcriptContainer.appendChild(item);
        this.elements.transcriptContainer.scrollTop = this.elements.transcriptContainer.scrollHeight;
    }

    // Credit information display
    displayCreditInformation(creditInfo) {
        // Helper function to safely format currency
        const formatCurrency = (value) => {
            return value !== null && value !== undefined ? value.toLocaleString('pl-PL') + ' zł' : 'Brak danych';
        };
        
        // Helper function to safely format period
        const formatPeriod = (period) => {
            if (period === null || period === undefined) {
                return 'Brak danych';
            }
            
            const years = Math.floor(period / 12);
            const months = period % 12;
            
            if (years > 0 && months > 0) {
                return `${years} ${years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat'} i ${months} ${months === 1 ? 'miesiąc' : months < 5 ? 'miesiące' : 'miesięcy'}`;
            } else if (years > 0) {
                return `${years} ${years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat'}`;
            } else {
                return `${months} ${months === 1 ? 'miesiąc' : months < 5 ? 'miesiące' : 'miesięcy'}`;
            }
        };
        
        // Helper function to safely format age
        const formatAge = (age) => {
            return age !== null && age !== undefined ? age + ' lat' : 'Brak danych';
        };

        const item = document.createElement('div');
        item.className = 'transcript-item credit-info';
        
        const timestamp = new Date().toLocaleTimeString();
        item.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="speaker credit">Dane Kredytowe</span>
            <div class="credit-details">
                <div class="credit-row">
                    <span class="credit-label">Kwota kredytu:</span>
                    <span class="credit-value">${formatCurrency(creditInfo.creditValue)}</span>
                </div>
                <div class="credit-row">
                    <span class="credit-label">Wartość zabezpieczenia:</span>
                    <span class="credit-value">${formatCurrency(creditInfo.secureValue)}</span>
                </div>
                <div class="credit-row">
                    <span class="credit-label">Okres kredytowania:</span>
                    <span class="credit-value">${formatPeriod(creditInfo.creditPeriod)}</span>
                </div>
                <div class="credit-row">
                    <span class="credit-label">Wiek klienta:</span>
                    <span class="credit-value">${formatAge(creditInfo.creditClientAge)}</span>
                </div>
            </div>
        `;

        this.elements.transcriptContainer.appendChild(item);
        this.elements.transcriptContainer.scrollTop = this.elements.transcriptContainer.scrollHeight;
    }

    // Error management
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorPanel.classList.remove('hidden');
    }

    hideError() {
        this.elements.errorPanel.classList.add('hidden');
        this.elements.errorMessage.textContent = '';
    }

    // Email form management
    showEmailForm() {
        this.elements.emailFormPanel.classList.remove('hidden');
        this.elements.emailInput.value = '';
        this.hideEmailStatus();
    }

    hideEmailForm() {
        this.elements.emailFormPanel.classList.add('hidden');
    }

    showEmailStatus(message, isSuccess = true) {
        this.elements.emailStatus.textContent = message;
        this.elements.emailStatus.classList.remove('hidden', 'success', 'error');
        this.elements.emailStatus.classList.add(isSuccess ? 'success' : 'error');
    }

    hideEmailStatus() {
        this.elements.emailStatus.classList.add('hidden');
    }

    getEmailValue() {
        return this.elements.emailInput.value.trim();
    }

    setEmailButtonLoading(loading) {
        this.elements.sendEmailBtn.disabled = loading;
        this.elements.sendEmailBtn.textContent = loading ? 'Wysyłanie...' : 'Wyślij oferty';
    }

    showOffersModal(offersData) {
        // Usuń istniejący modal ofert jeśli istnieje
        const existingModal = document.getElementById('offers-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const offers = offersData?.offers?.items || [];
        
        if (offers.length === 0) {
            this.showError('Nie znaleziono ofert kredytowych dla Twoich kryteriów.');
            return;
        }

        // Utwórz modal z ofertami
        const modalHTML = `
            <div id="offers-modal" class="offers-modal">
                <div class="offers-modal-content">
                    <div class="offers-header">
                        <div>
                            <h4 class="offers-title">Znalezione oferty kredytowe (${offers.length})</h4>
                            <p class="offers-subtitle">Poniżej przedstawiamy najlepsze oferty dopasowane do Twoich potrzeb:</p>
                        </div>
                        <button class="close-button" onclick="document.getElementById('offers-modal').remove()">✕</button>
                    </div>
                    <div class="offers-list">
                        ${offers.map(offer => this.createOfferCard(offer)).join('')}
                    </div>
                </div>
            </div>
        `;

        // Dodaj modal do body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Dodaj style CSS jeśli nie istnieją
        this.addOffersModalStyles();
    }

    createOfferCard(offer) {
        const bank = offer.bank || {};
        const logoUrl = bank.logo?.medium || '';
        const bankName = bank.name || 'Nieznany bank';
        const title = offer.title || 'Brak nazwy oferty';
        const creditValue = offer.cost?.creditValue || 0;
        const monthlyInstallment = offer.installment?.equal?.monthly || 0;
        const interestRate = offer.interest?.value || 0;

        return `
            <div class="offer-card">
                <div class="offer-header">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${bankName}" class="bank-logo">` : ''}
                    <div class="offer-title-section">
                        <h5 class="offer-title">${title}</h5>
                        <p class="bank-name">${bankName}</p>
                    </div>
                </div>
                <div class="offer-details">
                    <div class="offer-detail">
                        <span class="detail-label">Kwota kredytu:</span>
                        <span class="detail-value">${this.formatCurrency(creditValue)}</span>
                    </div>
                    <div class="offer-detail">
                        <span class="detail-label">Miesięczna rata:</span>
                        <span class="detail-value">${this.formatCurrency(monthlyInstallment)}</span>
                    </div>
                    <div class="offer-detail">
                        <span class="detail-label">Oprocentowanie:</span>
                        <span class="detail-value">${interestRate}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: 'PLN'
        }).format(amount);
    }

    addOffersModalStyles() {
        // Sprawdź czy style już istnieją
        if (document.getElementById('offers-modal-styles')) {
            return;
        }

        const styles = `
            <style id="offers-modal-styles">
                .offers-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                
                .offers-modal-content {
                    background: white;
                    border-radius: 12px;
                    max-width: 800px;
                    max-height: 80vh;
                    width: 90%;
                    overflow-y: auto;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }
                
                .offers-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: 20px;
                    border-bottom: 1px solid #eee;
                }
                
                .offers-title {
                    margin: 0 0 5px 0;
                    color: #333;
                    font-size: 1.4em;
                }
                
                .offers-subtitle {
                    margin: 0;
                    color: #666;
                    font-size: 0.9em;
                }
                
                .close-button {
                    background: none;
                    border: none;
                    font-size: 1.5em;
                    cursor: pointer;
                    color: #999;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .close-button:hover {
                    color: #333;
                }
                
                .offers-list {
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .offer-card {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    background: #f9f9f9;
                }
                
                .offer-header {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 15px;
                    padding: 0;
                    border: none;
                }
                
                .bank-logo {
                    width: 60px;
                    height: 40px;
                    object-fit: contain;
                }
                
                .offer-title-section {
                    flex: 1;
                }
                
                .offer-title {
                    margin: 0 0 5px 0;
                    font-size: 1.1em;
                    color: #333;
                }
                
                .bank-name {
                    margin: 0;
                    color: #666;
                    font-size: 0.9em;
                }
                
                .offer-details {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 10px;
                }
                
                .offer-detail {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                }
                
                .detail-label {
                    color: #666;
                    font-size: 0.9em;
                }
                
                .detail-value {
                    font-weight: bold;
                    color: #333;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }
}
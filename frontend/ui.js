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
            emailStatus: document.getElementById('email-status'),
            offersModal: document.getElementById('offers-modal'),
            offersCount: document.getElementById('offers-count'),
            offersList: document.getElementById('offers-list'),
            closeOffersModalBtn: document.getElementById('close-offers-modal')
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
        const offers = offersData?.offers?.items || [];
        
        if (offers.length === 0) {
            this.showError('Nie znaleziono ofert kredytowych dla Twoich kryteriów.');
            return;
        }
    
        // Aktualizuj licznik ofert
        document.getElementById('offers-count').textContent = offers.length;
        
        // Wypełnij listę ofert
        const offersList = document.getElementById('offers-list');
        offersList.innerHTML = offers.map(offer => this.createOfferCard(offer)).join('');
        
        // Pokaż modal
        document.getElementById('offers-modal').style.display = 'flex';
        
        // Dodaj event listener dla przycisku zamknięcia
        document.getElementById('close-offers-modal').onclick = () => {
            this.hideOffersModal();
        };
        
        // Zamknij modal po kliknięciu w tło
        document.getElementById('offers-modal').onclick = (e) => {
            if (e.target.id === 'offers-modal') {
                this.hideOffersModal();
            }
        };
    }
    
    hideOffersModal() {
        document.getElementById('offers-modal').style.display = 'none';
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
                        <span class="detail-value">${interestRate.toFixed(2)}%</span>
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


}
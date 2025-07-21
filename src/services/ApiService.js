/**
 * Serwis do komunikacji z API
 */
export class ApiService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  /**
   * Rozpoczyna nową sesję czatu
   */
  async startChat() {

    
    const response = await fetch(`${this.apiUrl}/chat/start.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ApiService: Start chat failed:', {
        status: response.status,
        statusText: response.statusText,
        responseBody: errorText
      });
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    
    return responseData;
  }

  /**
   * Wysyła wiadomość użytkownika
   */
  async sendMessage(sessionId, message) {
    const requestData = {
      sessionId,
      answer: message
    };
    
    
    
    const response = await fetch(`${this.apiUrl}/chat/answer.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ApiService: Request failed:', {
        status: response.status,
        statusText: response.statusText,
        url: `${this.apiUrl}/chat/answer.json`,
        requestData,
        responseBody: errorText
      });
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    
    return responseData;
  }

  /**
   * Pobiera oferty kredytowe
   */
  async getMortgageOffers(sessionId) {
    const response = await fetch(`${this.apiUrl}/chat/mortgage-offers/${sessionId}.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  }
}
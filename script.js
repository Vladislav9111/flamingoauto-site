const form = document.getElementById('car-form');
const popup = document.getElementById('popup');
const closeBtn = document.querySelector('.close-btn');
const photoInput = document.getElementById('photos');
const photoError = document.getElementById('photo-error');

// Initialize language on page load
document.addEventListener('DOMContentLoaded', function() {
    const isRussian = window.location.pathname.includes('ru.html');
    
    // Update button texts
    const submitBtn = document.getElementById('submit-btn');
    const heroBtn = document.querySelector('.btn');
    const popupMessage = document.querySelector('#popup p');
    
    if (isRussian) {
        if (submitBtn) submitBtn.textContent = 'Отправить заявку';
        if (heroBtn) heroBtn.textContent = 'Отправить заявку';
        if (popupMessage) popupMessage.textContent = 'Ваша заявка отправлена';
    } else {
        if (submitBtn) submitBtn.textContent = 'Saada päring';
        if (heroBtn) heroBtn.textContent = 'Saada päring';
        if (popupMessage) popupMessage.textContent = 'Teie ankeet on saadetud';
    }
});

function validatePhotos() {
    photoError.textContent = '';
    if (photoInput.files.length > 6) {
        // Check current page language for error message
        const isRussian = window.location.pathname.includes('ru.html');
        photoError.textContent = isRussian 
            ? 'Можно загрузить не более 6 фотографий.'
            : 'Saate üles laadida mitte rohkem kui 6 fotot.';
        return false;
    }
    return true;
}

photoInput.addEventListener('change', validatePhotos);

form.addEventListener('submit', async function(event) {
    event.preventDefault();

    const arePhotosValid = validatePhotos();
    
    // Force validation UI to show on all fields
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const isFormValid = form.checkValidity();

    if (isFormValid && arePhotosValid) {
        const submitButton = document.getElementById('submit-btn');
        const isRussian = window.location.pathname.includes('ru.html');
        
        submitButton.disabled = true;
        submitButton.textContent = isRussian ? 'Отправка...' : 'Saatmine...';

        const formElements = form.elements;

        // Prepare form data with photos
        const formData = new FormData();

        // Add text fields
        formData.append('regNumber', formElements['reg-number'].value);
        formData.append('make', formElements['make'].value);
        formData.append('model', formElements['model'].value);
        formData.append('year', formElements['year'].value);
        formData.append('mileage', formElements['mileage'].value);
        formData.append('transmission', formElements['transmission'].value);
        formData.append('engine', formElements['engine'].value);
        formData.append('price', formElements['price'].value);
        formData.append('name', formElements['name'].value);
        formData.append('email', formElements['email'].value);
        formData.append('phone', formElements['phone'].value);
        formData.append('city', formElements['city'].value);
        formData.append('note', formElements['note'].value);

        // Add photos
        const files = photoInput.files;
        for (let i = 0; i < files.length && i < 6; i++) {
            formData.append(`photo${i}`, files[i]);
        }
        formData.append('photoCount', files.length.toString());

        try {
            // Send to Netlify Function (with photos)
            const response = await fetch('/.netlify/functions/send-telegram', {
                method: 'POST',
                body: formData // No Content-Type header for FormData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Show success popup
                popup.classList.remove('hidden');
                form.reset();
                photoError.textContent = '';
            } else {
                throw new Error(result.error || 'Unknown error');
            }

        } catch (error) {
            console.error('Form submission error:', error);
            const errorMessage = isRussian 
                ? 'Не удалось отправить заявку. Пожалуйста, попробуйте еще раз.'
                : 'Küsimustikku ei õnnestunud saata. Palun proovige uuesti.';
            alert(errorMessage);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = isRussian ? 'Отправить заявку' : 'Saada päring';
        }

    } else {
        console.log('Form submission failed validation.');
        if(!isFormValid) form.reportValidity();
    }
});

function closePopup() {
    popup.classList.add('hidden');
}

closeBtn.addEventListener('click', closePopup);

popup.addEventListener('click', function(event) {
    // Close popup if the background overlay is clicked
    if (event.target === popup) {
        closePopup();
    }
});

// Insert dynamic year for both pages if elements exist
(function setFooterYear() {
    const year = new Date().getFullYear();
    const elEt = document.getElementById('year-et');
    const elRu = document.getElementById('year-ru');
    if (elEt) elEt.textContent = year;
    if (elRu) elRu.textContent = year;
})();

// Language switch initialization
(function initLangSwitch() {
    const switchContainer = document.querySelector('.lang-switch');
    if (!switchContainer) return;

    const buttons = switchContainer.querySelectorAll('.lang-btn');
    buttons.forEach(btn => {
        // Make Enter/Space activate link for keyboard users
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });

        // Set aria-pressed based on href matching current location
        try {
            const href = new URL(btn.href, location.href).pathname.split('/').pop();
            const current = location.pathname.split('/').pop() || 'index.html';
            btn.setAttribute('aria-pressed', href === current ? 'true' : 'false');
            if (href === current) btn.classList.add('active');
        } catch (e) {
            // Ignore URL errors
        }
    });
})();

// Debug function for testing Telegram integration
window.testTelegramFunction = async function() {
    console.log('🧪 Testing Telegram function...');

    const testData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+372 12345678',
        regNumber: '123 ABC',
        make: 'Volkswagen',
        model: 'Golf',
        city: 'Tallinn',
        note: 'Test message from debug function'
    };

    try {
        const response = await fetch('/.netlify/functions/send-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Telegram test SUCCESS:', result);
            alert('✅ Telegram test successful! Check console for details.');
        } else {
            console.error('❌ Telegram test FAILED:', result);
            alert('❌ Telegram test failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        alert('❌ Network error: ' + error.message);
    }
};

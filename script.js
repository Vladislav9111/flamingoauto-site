const form = document.getElementById('car-form');
const popup = document.getElementById('popup');
const closeBtn = document.querySelector('.close-btn');
const photoInput = document.getElementById('photos');
const photoError = document.getElementById('photo-error');

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
        
        // Prepare form data for Netlify Function
        const formData = {
            regNumber: formElements['reg-number'].value,
            make: formElements['make'].value,
            model: formElements['model'].value,
            year: formElements['year'].value,
            mileage: formElements['mileage'].value,
            transmission: formElements['transmission'].value,
            engine: formElements['engine'].value,
            price: formElements['price'].value,
            name: formElements['name'].value,
            email: formElements['email'].value,
            phone: formElements['phone'].value,
            city: formElements['city'].value,
            note: formElements['note'].value
        };

        try {
            // Send to Netlify Function
            const response = await fetch('/.netlify/functions/send-telegram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
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

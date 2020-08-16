const deleteProduct = (btn) => {
    const prodId = btn.parentNode.querySelector('[name=productId]').value;
    const csrfToken = btn.parentNode.querySelector('[name=_csrf]').value;

    const productElement = btn.closest('article');

    fetch('/admin/product/'+ prodId, {
        method: 'DELETE',
        headers: {
            'csrf-token': csrfToken
        }
    })
    .then(result => {
        return result.json();
    })
    .then(data => {
        console.log(data);
        if (data.success) {
            productElement.parentNode.removeChild(productElement);  //will work for all browsers
            //productElement.remove();  //will work in all modern browsers
        }
    })
    .catch(err => {
        console.log(err);
    });
};
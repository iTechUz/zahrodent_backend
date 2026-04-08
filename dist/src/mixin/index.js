function ApiMixin(Base) {
    return class extends Base {
        apiMethod() {
            console.log('ApiController method ishladi');
        }
    };
}
function BaseMixin(Base) {
    return class extends Base {
        baseMethod() {
            console.log('BaseController method ishladi');
        }
    };
}
//# sourceMappingURL=index.js.map
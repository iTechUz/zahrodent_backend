type Constructor<T = {}> = new (...args: any[]) => T;

function ApiMixin<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    apiMethod() {
      console.log('ApiController method ishladi');
    }
  };
}

function BaseMixin<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    baseMethod() {
      console.log('BaseController method ishladi');
    }
  };
}

// class LessonControllerBase {}
// const MixedController = ApiMixin(BaseMixin(LessonControllerBase));

// export class LessonController extends MixedController {
//   constructor() {
//     super();
//   }
// }

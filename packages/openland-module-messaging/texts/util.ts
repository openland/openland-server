export function templated<T extends { [key: string]: string } = any>(template: string) {
    return (vars: T) => {
        let rendered = '' + template;

        for (let key of Object.keys(vars)) {
            rendered = rendered.replace(new RegExp('{{' + key + '}}', 'g'), vars[key]);
        }

        return rendered;
    };
}
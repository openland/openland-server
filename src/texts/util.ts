export function templated<T extends { [key: string]: string } = any>(template: string) {
    return (vars: T) => {

        for (let key of Object.keys(vars)) {
            template = template.replace(new RegExp('{{' + key + '}}', 'g'), vars[key]);
        }

        return template;
    };
}
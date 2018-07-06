import { fastDeepEquals } from './fastDeepEquals';

describe('Deep equals', () => {
    it('Should compare correctly', () => {

        let a = {
            address: '2 SOUTH END AVENUE',
            owner_name: 'COVE CLUB CONDO',
            area: 2942.455069181227,
            count_rooms: 165,
            count_units: 2,
            count_stories: 9,
            year_built: 1990,
            land_value: 3560398,
            zoning: ['BPC'],
            searchId: ['1000167511', '1-16-7511'],
            displayId: '1000167511',
            shape_type: 'rectangle',
            analyzed: 'true',
            project_kassita1: 'true',
            project_kassita2: 'true',
            side1: 62.68661464990126,
            side2: 46.91940361217057,
            project_kassita1_angle: 1.570794191001649,
            project_kassita1_lon: -74.01724350073324,
            project_kassita1_lat: 40.707923499649745,
            project_kassita2_angle: 1.570794191001649,
            project_kassita2_lon: -74.01724350073324,
            project_kassita2_lat: 40.707923499649745
        };

        let b = {
            address: '2 SOUTH END AVENUE',
            owner_name: 'COVE CLUB CONDO',
            area: 2942.455069181227,
            count_rooms: 165,
            count_units: 2,
            count_stories: 9,
            year_built: 1990,
            land_value: 3560398,
            zoning: ['BPC'],
            searchId: ['1000167511', '1-16-7511'],
            displayId: '1000167511',
            shape_type: 'rectangle',
            analyzed: 'true',
            project_kassita1: 'true',
            project_kassita2: 'true',
            side1: 62.68661464990126,
            side2: 46.91940361217057,
            project_kassita1_angle: 1.570794191001649,
            project_kassita1_lon: -0.00007808142620291392,
            project_kassita1_lat: 0.000001997707368417423,
            project_kassita2_angle: 1.570794191001649,
            project_kassita2_lon: -0.00007808142620291392,
            project_kassita2_lat: 0.000001997707368417423
        };
        expect(fastDeepEquals(a, b)).toBe(false);
    });

    it('Arrays should work ok', () => {
        expect(fastDeepEquals([1, 2], [1, 2])).toBe(true);
        expect(fastDeepEquals([1, 2], [1])).toBe(false);
    });
});